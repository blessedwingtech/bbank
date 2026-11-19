import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { InterestService } from './interest.service';
import { InterestController } from './interest.controller';

@Module({
  controllers: [AccountController, InterestController],
  providers: [AccountService, InterestService],
  exports: [AccountService, InterestService],
})
export class AccountModule {}
