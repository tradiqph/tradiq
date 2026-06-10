import path from "node:path";
import ExcelJS from "exceljs";
import {
  normalizeInstapayAccountNumber,
  resolveInstapayBankName,
  type InstapayAccountSnapshot,
} from "@/lib/console/instapay-banks";

export interface InstapayWithdrawalRow {
  id: string;
  userEmail: string;
  amount: number;
  netPayout?: number;
  accountSnapshot: InstapayAccountSnapshot;
}

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "instapay_template.xlsx"
);
const DETAILS_SHEET = "Details";
const DATA_START_ROW = 2;
const MAX_TEMPLATE_ROWS = 999;

function payoutAmount(row: InstapayWithdrawalRow): number {
  if (typeof row.netPayout === "number" && row.netPayout > 0) {
    return Math.round(row.netPayout * 100) / 100;
  }
  return Math.round(row.amount * 100) / 100;
}

function buildRemarks(row: InstapayWithdrawalRow): string {
  const shortId = row.id.slice(0, 8);
  return `TradIQ ${shortId} · ${row.userEmail}`;
}

export async function buildInstapayExportBuffer(
  withdrawals: InstapayWithdrawalRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const sheet = workbook.getWorksheet(DETAILS_SHEET);
  if (!sheet) {
    throw new Error('InstaPay template is missing the "Details" sheet');
  }

  withdrawals.forEach((withdrawal, index) => {
    const rowNumber = DATA_START_ROW + index;
    if (rowNumber > MAX_TEMPLATE_ROWS) {
      throw new Error(
        `InstaPay template supports up to ${MAX_TEMPLATE_ROWS - 1} rows per export`
      );
    }

    const account = withdrawal.accountSnapshot;
    const excelRow = sheet.getRow(rowNumber);

    excelRow.getCell(1).value = resolveInstapayBankName(account);
    excelRow.getCell(2).value = account.accountName.trim();
    excelRow.getCell(3).value = normalizeInstapayAccountNumber(
      account.accountNumber
    );
    excelRow.getCell(4).value = payoutAmount(withdrawal);
    excelRow.getCell(5).value = buildRemarks(withdrawal);
    excelRow.commit();
  });

  for (
    let rowNumber = DATA_START_ROW + withdrawals.length;
    rowNumber <= MAX_TEMPLATE_ROWS;
    rowNumber++
  ) {
    const excelRow = sheet.getRow(rowNumber);
    excelRow.getCell(1).value = null;
    excelRow.getCell(2).value = null;
    excelRow.getCell(3).value = null;
    excelRow.getCell(4).value = null;
    excelRow.getCell(5).value = null;
    excelRow.commit();
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
