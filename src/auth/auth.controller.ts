import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { GenerateOtpDto, VerifyOtpDto, RefreshTokenDto } from './dto/auth.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('otp/generate')
  async generateOtp(@Body() generateOtpDto: GenerateOtpDto) {
    await this.authService.generateOTP(generateOtpDto.phone);
    return { message: 'OTP отправлен успешно' };
  }

  @Public()
  @Post('otp/verify')
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const { accessToken, refreshToken } = await this.authService.verifyOTP(
      verifyOtpDto.phone,
      verifyOtpDto.code
    );

    // Устанавливаем refresh token в httpOnly cookie
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    });

    return {
      accessToken,
      message: 'Аутентификация успешна',
    };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const { accessToken, refreshToken } = await this.authService.refreshTokens(
      refreshTokenDto.refreshToken
    );

    // Обновляем refresh token в cookie
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    });

    return {
      accessToken,
      message: 'Токены успешно обновлены',
    };
  }
}
