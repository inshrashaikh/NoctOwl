import {
  IsBoolean,
  IsDateString,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AssessRiskDto {
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lon?: number;

  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  speedKmh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  roadType?: string;

  @IsOptional()
  @IsBoolean()
  isNight?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  segmentId?: string;
}
