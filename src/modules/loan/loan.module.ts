import { Module } from '@nestjs/common';
import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';
import { LoanCalculatorService } from './loan-calculator.service';

@Module({
  controllers: [LoanController],
  providers: [LoanService, LoanCalculatorService],
  exports: [LoanService, LoanCalculatorService],
})
export class LoanModule {}
