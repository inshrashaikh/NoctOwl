import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Prisma } from '@prisma/client';

export class TriggerEmergencyDto {
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}
