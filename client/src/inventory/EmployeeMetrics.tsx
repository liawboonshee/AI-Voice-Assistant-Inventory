import type { EmployeeSummary } from './EmployeesData'
export default function EmployeeMetrics({ summary }: { summary: EmployeeSummary }) {
  return <span className="employee-metrics">
    <span className="employee-metric remaining"><span>手里剩余</span><strong>{summary.remainingCount}<small> 个</small></strong></span>
    <span className="employee-metric sold"><span>累计已出</span><strong>{summary.soldCount}<small> 个</small></strong></span>
    <span className="employee-metric amount"><span>出货金额</span><strong>RM{summary.salesAmount.toFixed(2)}</strong></span>
  </span>
}
