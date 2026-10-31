import type { EmployeeSummary } from './EmployeesData'
export default function EmployeeMetrics({ summary }: { summary: EmployeeSummary }) {
  return <span className="employee-metrics">
    <span className="employee-metric remaining"><span>手里剩余</span><strong>{summary.remainingCount}<small> 个</small></strong></span>
    <span className="employee-metric sold"><span>累计已出</span><strong>{summary.soldCount}<small> 个</small></strong></span>
    <span className="employee-metric cash"><span>手里现金</span><strong>RM{summary.cashAtSale.toFixed(2)}</strong></span>
    <span className="employee-metric transfer"><span>转账</span><strong>RM{summary.transferAtSale.toFixed(2)}</strong></span>
  </span>
}
