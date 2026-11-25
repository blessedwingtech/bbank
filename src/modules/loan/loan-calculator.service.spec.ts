import { Test, TestingModule } from '@nestjs/testing';
import { LoanCalculatorService } from './loan-calculator.service';
import { InterestCalculationMethod } from '@prisma/client';

describe('LoanCalculatorService', () => {
  let service: LoanCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoanCalculatorService],
    }).compile();

    service = module.get<LoanCalculatorService>(LoanCalculatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Declining Balance Amortization (Annuités constantes)', () => {
    it('should generate an accurate amortization schedule where sum of principal payments equals total amount', () => {
      const amount = 1000;
      const durationMonths = 12;
      const annualRate = 12; // 1% per month

      const result = service.calculateLoan(
        amount,
        durationMonths,
        annualRate,
        InterestCalculationMethod.declining_balance,
      );

      expect(result.schedule.length).toBe(12);
      expect(result.monthlyPayment).toBeGreaterThan(0);
      expect(result.totalInterest).toBeGreaterThan(0);
      expect(result.totalRepayable).toBeCloseTo(amount + result.totalInterest, 2);

      // Verify principal sum strictly equals principal
      const sumPrincipals = result.schedule.reduce((acc, curr) => acc + curr.principalAmount, 0);
      expect(sumPrincipals).toBeCloseTo(amount, 2);

      // Verify the final remaining balance is 0
      const lastInstallment = result.schedule[result.schedule.length - 1];
      expect(lastInstallment.remainingBalance).toBe(0);
    });

    it('should handle zero interest rate gracefully', () => {
      const amount = 1200;
      const durationMonths = 12;
      const annualRate = 0;

      const result = service.calculateLoan(
        amount,
        durationMonths,
        annualRate,
        InterestCalculationMethod.declining_balance,
      );

      expect(result.monthlyPayment).toBe(100);
      expect(result.totalInterest).toBe(0);
      expect(result.totalRepayable).toBe(1200);
      expect(result.schedule[11].remainingBalance).toBe(0);
    });
  });

  describe('Flat Rate Amortization', () => {
    it('should calculate constant interest and equal principal parts', () => {
      const amount = 1000;
      const durationMonths = 12;
      const annualRate = 10; // 10% flat over 1 year = 100€ interest

      const result = service.calculateLoan(
        amount,
        durationMonths,
        annualRate,
        InterestCalculationMethod.flat,
      );

      expect(result.totalInterest).toBe(100);
      expect(result.totalRepayable).toBe(1100);
      expect(result.schedule.length).toBe(12);

      // Verify principal sum strictly equals principal
      const sumPrincipals = result.schedule.reduce((acc, curr) => acc + curr.principalAmount, 0);
      expect(sumPrincipals).toBeCloseTo(amount, 2);

      const lastInstallment = result.schedule[result.schedule.length - 1];
      expect(lastInstallment.remainingBalance).toBe(0);
    });
  });
});
