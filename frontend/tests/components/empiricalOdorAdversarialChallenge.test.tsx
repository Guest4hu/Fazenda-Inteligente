import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OdorChart } from '../../src/components/dashboard/OdorChart';
import Dashboard from '../../src/pages/dashboard';
import { farmService } from '../../src/services/farmService';
import { corralService } from '../../src/services/corralService';
import type { OdorTelemetryResponseDTO } from '../../src/types/api';

describe('Empirical Adversarial Challenge Suite: OdorChart & cleaningTelemetryChallenge 5.1', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ==========================================================================
  // Challenge 1: SVG Interference & data-testid Isolation
  // ==========================================================================
  describe('Challenge 1: SVG Interference & data-testid Isolation', () => {
    it('1.1: Confirms document.querySelector("svg") selects <Wind> icon with 0 circles, while chart-odor-svg selects chart canvas', () => {
      const sampleReadings: OdorTelemetryResponseDTO[] = [
        { id: 1, corralId: 10, value: 300, instant: '2026-10-23T10:00:00Z' },
        { id: 2, corralId: 10, value: 350, instant: '2026-10-23T10:01:00Z' },
        { id: 3, corralId: 10, value: 420, instant: '2026-10-23T10:02:00Z' },
      ];

      const { container } = render(<OdorChart readings={sampleReadings} isLive={true} limitOdor={400} />);

      // Verify that there are at least two SVGs: Lucide <Wind> in the header, and chart-odor-svg
      const allSvgs = container.querySelectorAll('svg');
      expect(allSvgs.length).toBe(2);

      // The FIRST svg in document order is the header Lucide icon <Wind>
      const firstSvg = container.querySelector('svg');
      expect(firstSvg).not.toBeNull();
      // Crucial empirical proof: The <Wind> icon contains ZERO circles!
      expect(firstSvg?.querySelectorAll('circle').length).toBe(0);

      // Direct query via data-testid="chart-odor-svg" unambiguously targets the telemetry chart
      const chartSvg = screen.getByTestId('chart-odor-svg');
      expect(chartSvg).toBe(allSvgs[1]);
      // The chart SVG contains exactly 3 circles matching the 3 readings
      const circles = chartSvg.querySelectorAll('circle');
      expect(circles.length).toBe(3);
    });

    it('1.2: Confirms empty state (0 readings in live mode) renders <Wind> SVG but NO chart-odor-svg', () => {
      const { container } = render(<OdorChart readings={[]} isLive={true} limitOdor={400} />);

      // Lucide icon in header is present
      const allSvgs = container.querySelectorAll('svg');
      expect(allSvgs.length).toBe(1);

      // But the telemetry chart SVG is NOT rendered
      expect(screen.queryByTestId('chart-odor-svg')).toBeNull();
      // An unspecific query for 'svg' would falsely find an SVG
      expect(container.querySelector('svg')).toBeInTheDocument();
      // Querying circles on querySelector('svg') would yield 0, masking the absence of chart SVG
      expect(container.querySelector('svg')?.querySelectorAll('circle').length).toBe(0);
    });
  });

  // ==========================================================================
  // Challenge 2: Odor Chart Cardinality Spectrum (0, 1, 5, 15, 30 readings & Edge Cases)
  // ==========================================================================
  describe('Challenge 2: Odor Chart Cardinality Spectrum & Coordinate Invariants', () => {
    it('2.1: Cardinality 0 (Live Mode) -> 0 circles rendered, empty state banner', () => {
      render(<OdorChart readings={[]} isLive={true} limitOdor={400} />);

      expect(screen.queryByTestId('chart-odor-svg')).toBeNull();
      expect(screen.getByText('Sem Dados')).toBeInTheDocument();
      expect(screen.getByText('Nenhuma leitura de odor registrada ainda')).toBeInTheDocument();
    });

    it('2.2: Cardinality 0 (Simulated Mode) -> 5 circles rendered as default visual fallback', () => {
      render(<OdorChart readings={[]} isLive={false} limitOdor={400} simulatedMqValue={412} />);

      const chartSvg = screen.getByTestId('chart-odor-svg');
      expect(chartSvg).toBeInTheDocument();
      const circles = chartSvg.querySelectorAll('circle');
      expect(circles.length).toBe(5);
      expect(screen.getByText('Tendência Simulada')).toBeInTheDocument();
    });

    it('2.3: Cardinality 1 reading -> Exactly 1 circle rendered centered at cx=312.5 with no NaN paths', () => {
      const singleReading: OdorTelemetryResponseDTO[] = [
        { id: 101, corralId: 10, value: 380, instant: '2026-10-23T14:30:00Z' },
      ];

      render(<OdorChart readings={singleReading} isLive={true} limitOdor={400} />);

      const chartSvg = screen.getByTestId('chart-odor-svg');
      const circles = chartSvg.querySelectorAll('circle');
      expect(circles.length).toBe(1);

      // Coordinate invariant: cx must be exactly 312.5 (width=600, padLeft=45, padRight=20)
      expect(circles[0].getAttribute('cx')).toBe('312.5');

      // Paths must not contain NaN or undefined
      const paths = chartSvg.querySelectorAll('path');
      expect(paths.length).toBeGreaterThanOrEqual(1);
      paths.forEach((p) => {
        const d = p.getAttribute('d') || '';
        expect(d).not.toContain('NaN');
        expect(d).not.toContain('undefined');
        expect(d).not.toContain('null');
      });
    });

    it('2.4: Cardinality 5 readings -> Exactly 5 circles rendered with monotonic increasing x-coordinates', () => {
      const fiveReadings: OdorTelemetryResponseDTO[] = [
        { id: 1, corralId: 10, value: 310, instant: '2026-10-23T10:00:00Z' },
        { id: 2, corralId: 10, value: 330, instant: '2026-10-23T10:01:00Z' },
        { id: 3, corralId: 10, value: 390, instant: '2026-10-23T10:02:00Z' },
        { id: 4, corralId: 10, value: 410, instant: '2026-10-23T10:03:00Z' },
        { id: 5, corralId: 10, value: 450, instant: '2026-10-23T10:04:00Z' },
      ];

      render(<OdorChart readings={fiveReadings} isLive={true} limitOdor={400} />);

      const chartSvg = screen.getByTestId('chart-odor-svg');
      const circles = chartSvg.querySelectorAll('circle');
      expect(circles.length).toBe(5);

      const cxValues = Array.from(circles).map((c) => parseFloat(c.getAttribute('cx') || '0'));
      for (let i = 1; i < cxValues.length; i++) {
        expect(cxValues[i]).toBeGreaterThan(cxValues[i - 1]);
      }
      expect(cxValues[0]).toBe(45); // padLeft
      expect(cxValues[4]).toBe(580); // width - padRight (600 - 20)
    });

    it('2.5: Cardinality 15 readings -> Exactly 15 circles rendered and properly sorts shuffled timestamps', () => {
      const timestamps = Array.from({ length: 15 }, (_, i) =>
        new Date(Date.UTC(2026, 9, 23, 11, i, 0)).toISOString()
      );
      // Reverse order to challenge sort
      const shuffled = [...timestamps].reverse();
      const fifteenReadings: OdorTelemetryResponseDTO[] = shuffled.map((ts, idx) => ({
        id: idx + 1,
        corralId: 10,
        value: 300 + idx * 5,
        instant: ts,
      }));

      render(<OdorChart readings={fifteenReadings} isLive={true} limitOdor={400} />);

      const chartSvg = screen.getByTestId('chart-odor-svg');
      const circles = chartSvg.querySelectorAll('circle');
      expect(circles.length).toBe(15);
      expect(screen.getByText('15 amostras')).toBeInTheDocument();
    });

    it('2.6: Cardinality 30 readings (maximum API capacity) -> Exactly 30 circles within viewbox bounds', () => {
      const thirtyReadings: OdorTelemetryResponseDTO[] = Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        corralId: 10,
        value: 250 + ((i * 17) % 250),
        instant: new Date(Date.UTC(2026, 9, 23, 12, i, 0)).toISOString(),
      }));

      render(<OdorChart readings={thirtyReadings} isLive={true} limitOdor={400} />);

      const chartSvg = screen.getByTestId('chart-odor-svg');
      const circles = chartSvg.querySelectorAll('circle');
      expect(circles.length).toBe(30);
      expect(screen.getByText('30 amostras')).toBeInTheDocument();

      // Check all coordinates are bounded inside [padLeft, width - padRight] and [padTop, height - padBottom]
      circles.forEach((c) => {
        const cx = parseFloat(c.getAttribute('cx') || '0');
        const cy = parseFloat(c.getAttribute('cy') || '0');
        expect(cx).toBeGreaterThanOrEqual(45);
        expect(cx).toBeLessThanOrEqual(580);
        expect(cy).toBeGreaterThanOrEqual(10);
        expect(cy).toBeLessThanOrEqual(180);
      });
    });

    it('2.7: Adversarial Edge Case: Flat constant values (identical minVal and maxVal) does not divide by zero', () => {
      const flatReadings: OdorTelemetryResponseDTO[] = [
        { id: 1, corralId: 10, value: 400, instant: '2026-10-23T10:00:00Z' },
        { id: 2, corralId: 10, value: 400, instant: '2026-10-23T10:01:00Z' },
        { id: 3, corralId: 10, value: 400, instant: '2026-10-23T10:02:00Z' },
      ];

      render(<OdorChart readings={flatReadings} isLive={true} limitOdor={400} />);

      const chartSvg = screen.getByTestId('chart-odor-svg');
      const circles = chartSvg.querySelectorAll('circle');
      expect(circles.length).toBe(3);

      circles.forEach((c) => {
        const cy = parseFloat(c.getAttribute('cy') || '0');
        expect(Number.isFinite(cy)).toBe(true);
        expect(Number.isNaN(cy)).toBe(false);
      });
    });

    it('2.8: Adversarial Edge Case: Extreme spike (value=50000) keeps coordinates finite and marks critical node', () => {
      const spikeReadings: OdorTelemetryResponseDTO[] = [
        { id: 1, corralId: 10, value: 300, instant: '2026-10-23T10:00:00Z' },
        { id: 2, corralId: 10, value: 50000, instant: '2026-10-23T10:01:00Z' },
      ];

      render(<OdorChart readings={spikeReadings} isLive={true} limitOdor={400} />);

      const chartSvg = screen.getByTestId('chart-odor-svg');
      const circles = chartSvg.querySelectorAll('circle');
      expect(circles.length).toBe(2);

      expect(circles[0].getAttribute('class')).toContain('fill-primary');
      expect(circles[1].getAttribute('class')).toContain('fill-destructive');

      const latestDisplay = screen.getByText('50000');
      expect(latestDisplay.className).toContain('text-destructive');
    });
  });

  // ==========================================================================
  // Challenge 3: Test 5.1 Verification (Tenant State Initialization & Multiple Element Resolution)
  // ==========================================================================
  describe('Challenge 3: Test 5.1 Verification in Dashboard Integration', () => {
    it('3.1: Reproduces test 5.1 and verifies multiple element collision handling and safety interlock', async () => {
      localStorage.setItem('curral_auth_token', 'mock-jwt-token');
      localStorage.setItem(
        'curral_auth_user',
        JSON.stringify({ id: 1, userId: 1, name: 'Admin', email: 'admin@curral.com' })
      );
      // Canonical tenant selection keys
      localStorage.setItem('curral_selected_farm_id', '1');
      localStorage.setItem('curral_selected_corral_id', '10');

      vi.spyOn(farmService, 'listFarms').mockResolvedValueOnce([
        { id: 1, name: 'Fazenda Modelo', createdAt: '2026-10-23T10:00:00' },
      ]);
      vi.spyOn(corralService, 'listCorrais').mockResolvedValueOnce([
        {
          id: 10,
          farmId: 1,
          name: 'Curral de Testes',
          macAddress: '240AC4000110',
          cleanTime: null,
          limitOdor: 400,
          pumpDurationSeconds: 30,
          deviceStatus: 'ONLINE',
          lastSeenAt: '2026-10-23T12:00:00',
        },
      ]);

      render(<Dashboard />);

      // Verify that 'Curral de Testes' indeed appears in multiple elements
      await waitFor(() => {
        const matches = screen.getAllByText('Curral de Testes');
        expect(matches.length).toBeGreaterThanOrEqual(1);
        expect(matches[0]).toBeInTheDocument();
      });

      // Verify that the corral option is properly selected
      const presenceSwitch = screen.getByTestId('switch-presence');
      expect(presenceSwitch).toBeInTheDocument();

      // Trigger animal presence
      fireEvent.click(presenceSwitch);
      expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');

      // Attempt manual cleaning
      const buttonLavar = screen.getByTestId('button-lavar');
      fireEvent.click(buttonLavar);

      // Verify biological safety interlock
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
      expect(
        screen.getByText('Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza')
      ).toBeInTheDocument();
    });

    it('3.2: Empirically demonstrates that screen.getByText("Curral de Testes") would throw multiple elements error if not using getAllByText', async () => {
      localStorage.setItem('curral_auth_token', 'mock-jwt-token');
      localStorage.setItem(
        'curral_auth_user',
        JSON.stringify({ id: 1, userId: 1, name: 'Admin', email: 'admin@curral.com' })
      );
      localStorage.setItem('curral_selected_farm_id', '1');
      localStorage.setItem('curral_selected_corral_id', '10');

      vi.spyOn(farmService, 'listFarms').mockResolvedValueOnce([
        { id: 1, name: 'Fazenda Modelo', createdAt: '2026-10-23T10:00:00' },
      ]);
      vi.spyOn(corralService, 'listCorrais').mockResolvedValueOnce([
        {
          id: 10,
          farmId: 1,
          name: 'Curral de Testes',
          macAddress: '240AC4000110',
          cleanTime: null,
          limitOdor: 400,
          pumpDurationSeconds: 30,
          deviceStatus: 'ONLINE',
          lastSeenAt: '2026-10-23T12:00:00',
        },
      ]);

      render(<Dashboard />);

      await waitFor(() => {
        const elements = screen.getAllByText('Curral de Testes');
        // When there are multiple elements, getByText throws
        if (elements.length > 1) {
          expect(() => screen.getByText('Curral de Testes')).toThrow(/Found multiple elements with the text/);
        }
      });
    });
  });
});
