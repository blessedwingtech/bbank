import { Injectable } from '@nestjs/common';
import { InterestCalculationMethod } from '@prisma/client';

export interface CalculatedInstallment {
  installmentNumber: number;
  dueDate: Date;
  principalAmount: number;
  interestAmount: number;
  totalDue: number;
  remainingBalance: number;
}

export interface LoanSimulationResult {
  amount: number;
  durationMonths: number;
  annualInterestRate: number;
  method: InterestCalculationMethod;
  monthlyPayment: number;
  totalInterest: number;
  totalRepayable: number;
  schedule: CalculatedInstallment[];
}

@Injectable()
export class LoanCalculatorService {
  calculateLoan(
    amount: number,
    durationMonths: number,
    annualInterestRate: number,
    method: InterestCalculationMethod = InterestCalculationMethod.declining_balance,
    startDate: Date = new Date(),
  ): LoanSimulationResult {
    const monthlyRate = (annualInterestRate / 100) / 12;
    const schedule: CalculatedInstallment[] = [];

    let totalInterest = 0;
    let monthlyPayment = 0;

    if (method === InterestCalculationMethod.flat) {
      // FLAT RATE (Taux d'intérêt constant)
      const totalInt = Math.round(amount * (annualInterestRate / 100) * (durationMonths / 12) * 100) / 100;
      totalInterest = totalInt;
      const totalRepayable = amount + totalInterest;
      monthlyPayment = Math.round((totalRepayable / durationMonths) * 100) / 100;

      let remainingPrincipal = amount;
      const baseMonthlyPrincipal = Math.round((amount / durationMonths) * 100) / 100;
      const baseMonthlyInterest = Math.round((totalInterest / durationMonths) * 100) / 100;

      for (let i = 1; i <= durationMonths; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        let principal = baseMonthlyPrincipal;
        let interest = baseMonthlyInterest;

        // Adjust rounding on the last installment
        if (i === durationMonths) {
          principal = Math.round(remainingPrincipal * 100) / 100;
          interest = Math.round((totalInterest - (baseMonthlyInterest * (durationMonths - 1))) * 100) / 100;
        }

        remainingPrincipal -= principal;
        if (remainingPrincipal < 0 || i === durationMonths) remainingPrincipal = 0;

        schedule.push({
          installmentNumber: i,
          dueDate,
          principalAmount: principal,
          interestAmount: interest,
          totalDue: Math.round((principal + interest) * 100) / 100,
          remainingBalance: Math.round(remainingPrincipal * 100) / 100,
        });
      }
    } else {
      // DECLINING BALANCE (Amortissement dégressif à annuités constantes)
      if (monthlyRate === 0) {
        monthlyPayment = Math.round((amount / durationMonths) * 100) / 100;
      } else {
        const factor = Math.pow(1 + monthlyRate, durationMonths);
        monthlyPayment = Math.round((amount * ((monthlyRate * factor) / (factor - 1))) * 100) / 100;
      }

      let remainingPrincipal = amount;

      for (let i = 1; i <= durationMonths; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        const interest = Math.round(remainingPrincipal * monthlyRate * 100) / 100;
        let principal = Math.round((monthlyPayment - interest) * 100) / 100;

        // On last installment, absorb rounding differences
        if (i === durationMonths || principal > remainingPrincipal) {
          principal = Math.round(remainingPrincipal * 100) / 100;
        }

        totalInterest += interest;
        remainingPrincipal -= principal;
        if (remainingPrincipal < 0 || i === durationMonths) remainingPrincipal = 0;

        schedule.push({
          installmentNumber: i,
          dueDate,
          principalAmount: principal,
          interestAmount: interest,
          totalDue: Math.round((principal + interest) * 100) / 100,
          remainingBalance: Math.round(remainingPrincipal * 100) / 100,
        });
      }
    }

    totalInterest = Math.round(totalInterest * 100) / 100;
    const totalRepayable = Math.round((amount + totalInterest) * 100) / 100;

    return {
      amount,
      durationMonths,
      annualInterestRate,
      method,
      monthlyPayment,
      totalInterest,
      totalRepayable,
      schedule,
    };
  }
}
