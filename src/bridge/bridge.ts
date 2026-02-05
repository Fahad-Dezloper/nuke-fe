import { BACKEND_URL } from '@/constants';
import { QuoteParams } from './types';

export async function getQuote(quoteParams: QuoteParams) {
  const response = await fetch(`${BACKEND_URL}/bridge/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(quoteParams),
  });

  const data = await response.json();

  return data;
}

export async function executeBridgeTransfer(quoteParams: QuoteParams) {
  const quote = await getQuote(quoteParams);

  const quoteData = quote.steps[0].items[0].data;
  // TODO: sign the transaction here for quote.steps[0].items[0].data.sign
  const signature = '';

  const permitRequest = {
    signature,
    kind: quoteData.post.body.kind,
    request_id: quoteData.post.body.requestId,
    api: quoteData.post.body.api,
  };

  const response = await fetch(`${BACKEND_URL}/bridge/execute/permit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(permitRequest),
  });

  const data = await response.json();

  return data;
}
