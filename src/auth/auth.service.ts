import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import { UsersService } from '../users/users.service';
import { OTP } from './entities/otp.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    private httpService: HttpService,
    @InjectRepository(OTP)
    private otpRepository: Repository<OTP>
  ) {}

  private randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async generateOTP(phone: string): Promise<void> {
    // Проверяем, существует ли активный OTP для этого номера
    const existingOTP = await this.otpRepository.findOne({
      where: {
        phone,
        isUsed: false,
        expiresAt: new Date(Date.now()),
      },
    });

    if (existingOTP) {
      throw new BadRequestException('OTP уже был отправлен. Попробуйте позже.');
    }

    const code = this.randomNumber(1111, 9999).toString();
    const message = `SaudaPro one time password: ${code}`;
    const expiresAt = new Date(
      Date.now() + parseInt(this.configService.get('OTP_EXPIRES_IN')) * 1000
    );

    // Отправляем код через WhatsApp
    try {
      const url = this.configService.getOrThrow('WHATSAPP_SERVICE_URL');
      const authToken = this.configService.getOrThrow('WHATSAPP_SERVICE_TOKEN');

      await firstValueFrom(
        this.httpService
          .post(
            url,
            { to: phone, msg: message },
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            }
          )
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error(error.response?.data);
              throw new BadRequestException('Ошибка отправки кода');
            })
          )
      );

      // Сохраняем OTP в базе
      const otp = this.otpRepository.create({
        phone,
        code,
        expiresAt,
      });
      await this.otpRepository.save(otp);

      // В режиме разработки выводим код в консоль
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`OTP для ${phone}: ${code}`);
      }
    } catch (error) {
      this.logger.error('Ошибка при отправке OTP:', error);
      throw new BadRequestException(
        'Не удалось отправить код. Попробуйте позже.'
      );
    }
  }

  async verifyOTP(
    phone: string,
    code: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const otp = await this.otpRepository.findOne({
      where: {
        phone,
        code,
        isUsed: false,
        expiresAt: new Date(Date.now()),
      },
    });

    if (!otp) {
      throw new UnauthorizedException('Неверный код или срок действия истек');
    }

    // Помечаем OTP как использованный
    otp.isUsed = true;
    await this.otpRepository.save(otp);

    // Находим или создаем пользователя
    let user = await this.usersService.findByPhone(phone);
    if (!user) {
      user = await this.usersService.create({ phone });
    }

    // Генерируем токены
    const payload = { sub: user.id, phone: user.phone };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN'),
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('REFRESH_TOKEN_SECRET'),
      });

      const user = await this.usersService.findOne(payload.sub);
      const newPayload = { sub: user.id, phone: user.phone };

      const accessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get('REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN'),
      });

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
