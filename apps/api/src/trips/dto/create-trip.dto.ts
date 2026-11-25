import {
  IsDateString,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTripDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsLatitude()
  startLat?: number;

  @IsOptional()
  @IsLongitude()
  startLon?: number;

  @IsOptional()
  @IsLatitude()
  endLat?: number;

  @IsOptional()
  @IsLongitude()
  endLon?: number;
}
