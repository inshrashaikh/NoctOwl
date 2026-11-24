import {
  IsBoolean,
  IsHexColor,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { GeoJsonPolygonInput } from './create-safe-zone.dto';

export class UpdateSafeZoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsObject()
  geometry?: GeoJsonPolygonInput;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  radius?: number;

  @IsOptional()
  @IsLatitude()
  centerLat?: number;

  @IsOptional()
  @IsLongitude()
  centerLon?: number;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
