import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum SyncActionType {
  LOCATION = 'LOCATION',
  TRIP_STATUS = 'TRIP_STATUS',
  GEOFENCE_CHECK = 'GEOFENCE_CHECK',
}

export class SyncActionDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsEnum(SyncActionType)
  type!: SyncActionType;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsDateString()
  occurredAt!: string;
}

export class SyncBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncActionDto)
  actions!: SyncActionDto[];
}
