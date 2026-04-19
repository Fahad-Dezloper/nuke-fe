export const timeframeTabs = ['Day', 'Week', 'Month', 'All'] as const;

export type TimeframeTab = (typeof timeframeTabs)[number];

export const performanceByTimeframe: Record<
  TimeframeTab,
  {
    volume: string;
    strategiesOpened: string;
    pnl: string;
  }
> = {
  Day: {
    volume: '$0.00',
    strategiesOpened: '0',
    pnl: '$0',
  },
  Week: {
    volume: '$0.00',
    strategiesOpened: '0',
    pnl: '$0',
  },
  Month: {
    volume: '$0.00',
    strategiesOpened: '0',
    pnl: '$0',
  },
  All: {
    volume: '$0.00',
    strategiesOpened: '0',
    pnl: '$0',
  },
};

export const exchanges = [
  {
    name: 'Hyperliquid',
    mark: 'HL',
    availableBalance: '--',
    totalEquity: '--',
  },
  {
    name: 'Backpack',
    mark: 'BP',
    availableBalance: '--',
    totalEquity: '--',
  },
  {
    name: 'Pacifica',
    mark: 'Pa',
    availableBalance: '--',
    totalEquity: '--',
  },
  {
    name: 'trade[xyz]',
    mark: 'T',
    availableBalance: '--',
    totalEquity: '--',
  },
  {
    name: 'All Exchanges',
    mark: null,
    availableBalance: '$0.00',
    totalEquity: '$0.00',
    highlighted: true,
  },
] as const;

export const chartYLabels = ['$4', '$3', '$2', '$1', '$0'];

export const chartXLabels = [
  '2 PM',
  '3 PM',
  '4 PM',
  '5 PM',
  '6 PM',
  '7 PM',
  '8 PM',
  '9 PM',
  '10 PM',
  '11 PM',
  '12 AM',
  '1 AM',
  '2 AM',
  '3 AM',
  '4 AM',
  '5 AM',
  '6 AM',
  '7 AM',
  '8 AM',
  '9 AM',
  '10 AM',
  '11 AM',
  '1 PM',
] as const;
