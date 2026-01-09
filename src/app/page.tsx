import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-8'>
        <h1 className='text-4xl font-bold text-text-primary mb-2'>
          Welcome to <span className='text-accent'>Nuke</span>
        </h1>
        <p className='text-text-muted-60 text-lg'>
          Perpetual Arbitrage Terminal
        </p>
      </div>

      <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>
              View your trading overview and statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className='w-full'>Go to Dashboard</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Positions</CardTitle>
            <CardDescription>
              Manage your active arbitrage positions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant='secondary'
              className='w-full'>
              View Positions
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strategies</CardTitle>
            <CardDescription>
              Configure and monitor your trading strategies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant='outline'
              className='w-full'>
              Manage Strategies
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
