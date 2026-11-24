import { IsLatitude, IsLongitude } from 'class-validator';

export class CheckGeofenceDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lon!: number;
}
