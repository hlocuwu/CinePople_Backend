import { IsString, IsNotEmpty, IsDateString, IsNumber, Min, IsOptional } from 'class-validator';

export class CreateShowtimeDto {
  @IsString()
  @IsNotEmpty()
  movieId!: string;

  @IsString()
  @IsNotEmpty()
  cinemaId!: string;

  @IsString()
  @IsNotEmpty()
  roomName!: string;

  @IsDateString()
  @IsNotEmpty()
  startTime!: string; // ISO Date String

  @IsNumber()
  @Min(0)
  price!: number; // Giá vé cơ bản
}

export class UpdateShowtimeDto {
  @IsString()
  @IsOptional()
  movieId?: string;

  @IsString()
  @IsOptional()
  cinemaId?: string;

  @IsString()
  @IsOptional()
  roomName?: string;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;
}