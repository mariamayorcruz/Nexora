// Migración: agrega campos para automatización IA en User

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "iaAutomationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN     "iaAutomationMaxBudget" DOUBLE PRECISION;
