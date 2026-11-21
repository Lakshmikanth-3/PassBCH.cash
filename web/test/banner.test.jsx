import React from 'react';
import { render, screen } from '@testing-library/react';
import Banner from '../src/components/Banner.jsx';
import { CONFIG } from '../src/config.js';

describe('BLAZE banner', () => {
  test('links GitHub, first commit and shows the EMBER2026 address', () => {
    render(<Banner config={CONFIG} />);
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', CONFIG.repoUrl);
    expect(screen.getByRole('link', { name: 'first commit' })).toHaveAttribute('href', `${CONFIG.repoUrl}/commit/${CONFIG.firstCommit}`);
    expect(screen.getByTitle(/EMBER2026/)).toBeInTheDocument();
    expect(screen.getByText(/all code written during BLAZE/)).toBeInTheDocument();
  });
  test('deck link appears once set', () => {
    render(<Banner config={{ ...CONFIG, deckUrl: 'https://docs.google.com/presentation/d/x' }} />);
    expect(screen.getByRole('link', { name: 'Deck' })).toHaveAttribute('href', 'https://docs.google.com/presentation/d/x');
  });
  test('network pill shows on test networks only', () => {
    const { rerender } = render(<Banner config={{ ...CONFIG, network: 'chipnet' }} />);
    expect(screen.getByText('chipnet')).toBeInTheDocument();
    rerender(<Banner config={{ ...CONFIG, network: 'mainnet' }} />);
    expect(screen.queryByText('chipnet')).toBeNull();
  });
});
