import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoneField } from './PhoneField';

/*
 * The telephone field the way the desk uses it: digits typed fast, the
 * country picked once in a while, and one `+420…` string going out.
 */

function Harness({ initial = '', onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PhoneField
        label="Telefon"
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <output data-testid="stored">{value}</output>
    </>
  );
}

describe('the telephone field', () => {
  it('starts on Česko and stores the number with +420', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    expect(screen.getByRole('button', { name: /Předvolba \+420/ })).toBeInTheDocument();
    expect(screen.getByTestId('phone-country-note')).toHaveTextContent('Česko');

    await userEvent.type(screen.getByLabelText('Telefon'), '773539001');
    expect(screen.getByLabelText('Telefon')).toHaveValue('773 539 001');
    expect(screen.getByTestId('stored')).toHaveTextContent('+420773539001');
    expect(onChange).toHaveBeenLastCalledWith('+420773539001');
  });

  it('stores nothing for an empty number - +420 alone is not a telephone', async () => {
    render(<Harness initial="+420773539001" />);
    await userEvent.clear(screen.getByLabelText('Telefon'));
    expect(screen.getByTestId('stored')).toHaveTextContent('');
  });

  it('reads a stored +421 back into the picker and names the country under the field', () => {
    render(<Harness initial="+421908123456" />);
    expect(screen.getByRole('button', { name: /Předvolba \+421/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).toHaveValue('908 123 456');
    expect(screen.getByTestId('phone-country-note')).toHaveTextContent('Slovensko');
  });

  it('reads a bare national number as Česko', () => {
    render(<Harness initial="773539001" />);
    expect(screen.getByLabelText('Telefon')).toHaveValue('773 539 001');
    expect(screen.getByTestId('stored')).toHaveTextContent('773539001');
  });

  it('follows a dialling code typed into the number box', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Telefon'), '+421 908 123 456');
    expect(screen.getByTestId('stored')).toHaveTextContent('+421908123456');
    expect(screen.getByTestId('phone-country-note')).toHaveTextContent('Slovensko');
    /* Leaving the box tidies the typed code into the picker. */
    fireEvent.blur(screen.getByLabelText('Telefon'));
    expect(screen.getByLabelText('Telefon')).toHaveValue('908 123 456');
    expect(screen.getByRole('button', { name: /Předvolba \+421/ })).toBeInTheDocument();
  });

  it('picks a country from the searchable menu - by digits or by name', async () => {
    render(<Harness initial="+420773539001" />);
    await userEvent.click(screen.getByRole('button', { name: /Předvolba \+420/ }));

    const search = screen.getByLabelText('Hledat zemi nebo předvolbu');
    await userEvent.type(search, 'slov');
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Slovensko/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Slovinsko/ })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: /Česko/ })).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, '421');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(1);
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Slovensko/ }));

    /* The number stays, the code changes, the note says where it now points. */
    expect(screen.getByLabelText('Telefon')).toHaveValue('773 539 001');
    expect(screen.getByTestId('stored')).toHaveTextContent('+421773539001');
    expect(screen.getByTestId('phone-country-note')).toHaveTextContent('Slovensko');
    expect(screen.getByRole('button', { name: /Předvolba \+421 Slovensko/ })).toBeInTheDocument();
  });

  it('shows an unknown dialling code as typed and says so', () => {
    render(<Harness initial="+9991234567" />);
    expect(screen.getByLabelText('Telefon')).toHaveValue('+9991234567');
    expect(screen.getByTestId('phone-country-note')).toHaveTextContent('Jiná země');
    expect(screen.getByTestId('stored')).toHaveTextContent('+9991234567');
  });

  it('is reachable through an outside label by id and shows its helper text', () => {
    render(
      <>
        <label htmlFor="phone-1">Telefon pacienta</label>
        <PhoneField id="phone-1" value="" onChange={() => {}} error helperText="Telefon není ve správném tvaru." />
      </>,
    );
    expect(screen.getByLabelText('Telefon pacienta')).toBeInTheDocument();
    expect(screen.getByText('Telefon není ve správném tvaru.')).toBeInTheDocument();
  });
});
