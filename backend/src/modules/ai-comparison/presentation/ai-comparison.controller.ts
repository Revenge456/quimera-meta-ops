import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import type { AuthUser } from '../../shared/types/auth-user.type';
import { AiComparisonService } from '../application/ai-comparison.service';

class CompareAnalysesDto {
  @IsString()
  currentAnalysisId!: string;

  @IsOptional()
  @IsString()
  previousAnalysisId?: string;

  @IsOptional()
  @IsString()
  contextHash?: string;
}

@Controller('ai-strategist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'commercial_manager')
export class AiComparisonController {
  constructor(private readonly aiComparisonService: AiComparisonService) {}

  @Post('compare')
  compare(
    @CurrentUser() user: AuthUser,
    @Body() body: CompareAnalysesDto,
  ) {
    return this.aiComparisonService.compare(user, body);
  }
}
