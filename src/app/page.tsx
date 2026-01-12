import { MarketOverview } from '@/components/features/market-overview';
import {
  TradingDashboard,
  ChartSectionContent,
  PositionsTableSectionContent,
  PositionControlsSectionContent,
} from '@/components/features';

export default function Home() {
  return (
    <div className='flex flex-col h-full overflow-hidden'>
      <div className='shrink-0'>
        <MarketOverview />
      </div>
      <TradingDashboard className='flex-1 min-h-0'>
        {/* Left Side - Chart Section */}
        <div className='flex-1 flex flex-col overflow-hidden min-w-0'>
          <div className='mb-4 shrink-0'>
            <ChartSectionContent />
          </div>
          <div className='flex-1 min-h-0'>
            <PositionsTableSectionContent />
          </div>
        </div>

        {/* Right Side - Position Controls */}
        <PositionControlsSectionContent />
      </TradingDashboard>
    </div>
  );
}
