import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { SyncBatchResult, SyncService } from './sync.service';

@ApiTags('Offline Sync')
@ApiBearerAuth()
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process idempotent offline sync queue batch' })
  @ApiResponse({ status: 200, description: 'Batch processed with per-item results' })
  processBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SyncBatchDto,
  ): Promise<SyncBatchResult> {
    return this.syncService.processBatch(user.userId, dto);
  }
}
