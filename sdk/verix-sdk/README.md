# @sumitshinde0702/verix-sdk

Tiny SDK wrapper for Verix backend APIs.

## Install

```bash
npm install @sumitshinde0702/verix-sdk
```

## 20-line quickstart

```ts
import { VerixClient } from '@sumitshinde0702/verix-sdk';

const verix = new VerixClient('http://localhost:3001');

const source = verix.streamDemo({
  query: 'Fetch Chainlink price data',
  failAt: 'none',
  onEvent: (ev) => {
    console.log(ev.step, ev.status, ev.message);
    if (ev.step === 'dids_registered' && ev.data?.workerDID) {
      console.log('Worker DID:', ev.data.workerDID);
    }
  },
  onDone: async () => {
    const did = 'did:xrpl:1:rfD6...'; // use worker DID from stream
    const rep = await verix.getReputationHistoryByDid(did);
    console.log('Current score:', rep.currentScore);
  },
  onError: (err) => console.error('stream error', err),
});

// source.close() if you need to stop early
```

