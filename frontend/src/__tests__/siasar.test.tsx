/**
 * Pruebas de SiasarComunidadInfo: el contenido del diagnóstico SIASAR de
 * una comunidad -- cobertura de agua/saneamiento, calificación, los
 * sistemas que la abastecen (cloración + última prueba de laboratorio), y
 * los casos sin dato (población atípica, sin calificación, sin sistemas).
 *
 * Componente puro (sin API, sin navegación, sin contexto) -- se renderiza
 * directo, sin providers.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import SiasarComunidadInfo from '../components/SiasarComunidadInfo';
import type { ComunidadDetalle } from '../types/domain';

const BASE: ComunidadDetalle = {
  id_siasar: 1,
  nombre: 'Vereda El Rosal',
  municipio: 'Zipaquirá',
  localidad: 'El Rosal',
  latitud: 5.03,
  longitud: -74.0,
  poblacion: 420,
  viviendas: 95,
  poblacion_atipica: false,
  cobertura_agua: 0.8,
  cobertura_saneamiento: 0.55,
  n_escuelas: 2,
  sistemas_texto: null,
  prestador: 'Acueducto Comunitario El Rosal',
  calificacion: 'B',
  fecha_encuesta: '2024-03-15',
  fecha_importacion: '2024-04-01T00:00:00Z',
  sistemas: [
    {
      id_siasar: 10,
      nombre: 'Sistema El Rosal',
      cloracion: 'FUNCIONA',
      prueba_coliformes: 'PASA',
      prueba_fisicoquimica: 'PASA',
      horas_servicio: 24,
      fecha_encuesta: '2024-03-15',
    },
  ],
  fuente: 'SIASAR',
};

test('muestra localidad, municipio y calificación', () => {
  render(<SiasarComunidadInfo data={BASE} />);

  expect(screen.getByText('El Rosal · Zipaquirá')).toBeTruthy();
  expect(screen.getByText('Calificación SIASAR: B')).toBeTruthy();
});

test('muestra población, viviendas y coberturas redondeadas a porcentaje', () => {
  render(<SiasarComunidadInfo data={BASE} />);

  expect(screen.getByText('Población: 420')).toBeTruthy();
  expect(screen.getByText('Viviendas: 95')).toBeTruthy();
  expect(screen.getByText('Cobertura de agua: 80% · saneamiento: 55%')).toBeTruthy();
  expect(screen.getByText('2 escuela(s) registrada(s)')).toBeTruthy();
});

test('marca la población como dato por verificar cuando es atípica', () => {
  render(<SiasarComunidadInfo data={{ ...BASE, poblacion_atipica: true }} />);

  expect(screen.getByText('Población: 420 (dato por verificar)')).toBeTruthy();
});

test('muestra "sin dato" cuando no hay coberturas y "—" cuando faltan población/viviendas', () => {
  render(<SiasarComunidadInfo data={{
    ...BASE, poblacion: null, viviendas: null, cobertura_agua: null, cobertura_saneamiento: null, n_escuelas: null,
  }} />);

  expect(screen.getByText('Población: —')).toBeTruthy();
  expect(screen.getByText('Viviendas: —')).toBeTruthy();
  expect(screen.getByText('Cobertura de agua: sin dato · saneamiento: sin dato')).toBeTruthy();
  expect(screen.getByText('Sin escuelas registradas')).toBeTruthy();
});

test('no muestra el badge de calificación cuando no hay una', () => {
  render(<SiasarComunidadInfo data={{ ...BASE, calificacion: null }} />);

  expect(screen.queryByText(/Calificación SIASAR/)).toBeNull();
});

test('lista los sistemas que abastecen la comunidad con su cloración y prueba de coliformes', () => {
  render(<SiasarComunidadInfo data={BASE} />);

  expect(screen.getByText('Sistemas que la abastecen')).toBeTruthy();
  expect(screen.getByText('Sistema El Rosal')).toBeTruthy();
  expect(screen.getByText('Cloración: Funciona')).toBeTruthy();
  expect(screen.getByText('Última prueba de coliformes registrada: Pasa')).toBeTruthy();
});

test('no muestra la sección de sistemas cuando la comunidad no tiene ninguno', () => {
  render(<SiasarComunidadInfo data={{ ...BASE, sistemas: [] }} />);

  expect(screen.queryByText('Sistemas que la abastecen')).toBeNull();
});

test('muestra el prestador cuando existe, y siempre la fuente con la fecha de encuesta', () => {
  render(<SiasarComunidadInfo data={BASE} />);

  expect(screen.getByText('Prestador: Acueducto Comunitario El Rosal')).toBeTruthy();
  expect(screen.getByText('Fuente: SIASAR – Ministerio de Vivienda · encuesta 15/03/2024')).toBeTruthy();
});

test('no muestra la línea de prestador cuando no hay uno registrado', () => {
  render(<SiasarComunidadInfo data={{ ...BASE, prestador: null }} />);

  expect(screen.queryByText(/^Prestador:/)).toBeNull();
});
