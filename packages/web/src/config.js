// Public, non-secret configuration shown in the UI.
export const CONFIG = {
  network: 'chipnet', // switched to 'mainnet' only at final submission
  repoUrl: 'https://github.com/Lakshmikanth-3/PassRate.cash',
  deckUrl: null, // Widget Factory deck: added in Phase 4
  emberAddress: 'bitcoincash:zrcvv9gjvgeeh6gesa2t3q0z40n3uzxwhua3m6rsyf',
  ticketSats: 20000,
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
