import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { UsersService } from '../users/users.service';
import { OTP } from './entities/otp.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    @InjectRepository(OTP)
    private otpRepository: Repository<OTP>
  ) {}

  private randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async generateOTP(phone: string): Promise<void> {
    console.log('\n==================================');
    console.log('Генерация OTP кода');
    console.log('==================================\n');

    // Проверяем, существует ли активный OTP для этого номера
    const existingOTP = await this.otpRepository.findOne({
      where: {
        phone,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (existingOTP) {
      console.log(`🔑 Существующий код для ${phone}:`);
      console.log(`👉 ${existingOTP.code}`);
      console.log(`⏰ Действителен до: ${existingOTP.expiresAt}`);
      console.log('\n==================================\n');
      return;
    }

    // Удаляем старые OTP для этого номера
    await this.otpRepository.delete({
      phone,
      expiresAt: LessThan(new Date()),
    });

    const code = this.randomNumber(1111, 9999).toString();
    const expiresAt = new Date(
      Date.now() + parseInt(this.configService.get('OTP_EXPIRES_IN')) * 1000
    );

    // Сохраняем OTP в базе
    const otp = this.otpRepository.create({
      phone,
      code,
      expiresAt,
    });
    await this.otpRepository.save(otp);

    // Выводим код в консоль
    console.log(`🔑 Новый код для ${phone}:`);
    console.log(`👉 ${code}`);
    console.log(`⏰ Действителен до: ${expiresAt}`);
    console.log('\n==================================\n');
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
        expiresAt: MoreThan(new Date()),
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
    const payload = {
      sub: user.id,
      phone: user.phone,
      isSuperAdmin: user.isSuperAdmin,
    };

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
