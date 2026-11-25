import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AiService, TripRiskAssessmentResult } from './ai.service';
import { AssessRiskDto } from './dto/assess-risk.dto';

@Controller('trips/:tripId')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('risk-assess')
  @HttpCode(HttpStatus.OK)
  assessTripRisk(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() dto: AssessRiskDto,
  ): Promise<TripRiskAssessmentResult> {
    return this.aiService.assessTripRisk(tripId, user.userId, dto);
  }
}
