import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { normalizePhoneNumber } from '../utils/phone.util';

export function IsPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isPhoneNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          const normalized = normalizePhoneNumber(value);
          return /^\+7\d{10}$/.test(normalized);
        },
        defaultMessage(args: ValidationArguments) {
          return 'Некорректный номер телефона';
        },
      },
    });
  };
}
