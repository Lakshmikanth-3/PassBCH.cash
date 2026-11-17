// Public, non-secret configuration shown in the UI.
export const CONFIG = {
  network: 'chipnet', // switched to 'mainnet' only at final submission
  repoUrl: 'https://github.com/Lakshmikanth-3/PassRate.cash',
  demoUrl: 'https://passrate-cash.vercel.app',
  firstCommit: '29388349185c1e553e30cd6fca99d296a25c6bd7', // 17 Nov 2026, first line of code
  deckUrl: null, // copy of the official Widget Factory template: link pending
  emberAddress: 'bitcoincash:zrcvv9gjvgeeh6gesa2t3q0z40n3uzxwhua3m6rsyf',
  ticketSats: 20000,
  // Operator public key and inbox (public data; the covenant is built from operatorPk).
  operator: { pkHex: '031edc6ca15b97a905db2bf61f5d1341869a58754633e1f82c166b4e909d6767ac', inbox: 'bchtest:qzmuv37ealgxg3cm3t9vqawusm6q4t5wysv50yfxkn' },
  rows: [
    { agentIdx: 0, model: 'gpt-oss-20b', label: 'Small model' },
    { agentIdx: 1, model: 'gpt-oss-120b', label: 'Large model' },
  ],
  scheduleEvery: 2,
  explorerTx: {
    chipnet: (txid) => `https://chipnet.imaginary.cash/tx/${txid}`,
    mainnet: (txid) => `https://explorer.salemkode.com/tx/${txid}`,
  },
};

/**
 * Real chipnet transactions from the Phase 1 T1 test (17 Nov 2026).
 * The START is a genuine covenant spend of the ticket. No RESULT exists yet for this chain.
 */
export const T1_CHAIN = {
  network: 'chipnet',
  covenant: 'bchtest:pvuxp4ku9wn0grvmxkh8gecgyxfcdz6y5f2wyr4yzupdq7mtuhmjge08x8emq',
  ticket: '1eadee28704a8a20ea603d6bd28aeacc7f22e7fa070de39b676f01cff578a18a',
  start: '599a8cbc9ab957a28d94fe48bba55622e72796c7f8273d42fdb5a74d27477843',
  result: null,
  refundTicket: '09a445af12ae6d13810a71d618261664ad69aafcbb624cce5cd2afc618400baa',
  refund: '6d1deb4315f54a96b1f4dc6b76118007c8c402d39d6ab783409bb421a365d8be',
};
