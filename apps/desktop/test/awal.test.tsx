import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'
import { buatPlatformPalsu } from './platform-palsu'

describe('pengaturan awal & masuk', () => {
  it('membuat admin baru lalu masuk ke beranda', async () => {
    const pf = buatPlatformPalsu()
    const u = userEvent.setup()
    render(<App platform={pf} jedaSimpanMs={10} />)
    await screen.findByText('Pengaturan awal')
    await u.type(screen.getByLabelText('Kata sandi admin'), 'sandi-admin-123')
    await u.type(screen.getByLabelText('Ulangi kata sandi'), 'sandi-admin-123')
    await u.click(screen.getByRole('button', { name: 'Buat database admin' }))
    await screen.findByRole('heading', { name: 'Beranda' }, { timeout: 20000 })
    await waitFor(() => expect(pf.db).not.toBeNull())
  })
})
