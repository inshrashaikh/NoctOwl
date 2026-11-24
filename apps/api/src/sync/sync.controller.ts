import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { SyncBatchResult, SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  processBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SyncBatchDto,
  ): Promise<SyncBatchResult> {
    return this.syncService.processBatch(user.userId, dto);
  }
}
