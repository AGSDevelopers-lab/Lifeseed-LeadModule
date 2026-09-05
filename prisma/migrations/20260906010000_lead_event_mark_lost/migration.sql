-- Additive: T-21 / T-24 / T-25 / T-26 persist LeadStatusHistory.event = mark_lost
ALTER TYPE "LeadEvent" ADD VALUE IF NOT EXISTS 'mark_lost';
