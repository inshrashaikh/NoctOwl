import {
  IsBoolean,
  IsHexColor,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export interface GeoJsonPolygonInput {
  type: string;
  coordinates: number[][][];
}

export class CreateSafeZoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

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
