# Biomedical V8 — Cuidado de Heridas

Esta versión parte de V7 Connected y conserva Control de Entrega de Materiales.

## Nuevo módulo
- Mis pacientes: solo pacientes asignados al enfermero.
- Super Admin: acceso a Todos los pacientes.
- Ficha del paciente y estado de autorización.
- Historial clínico por paciente.
- Gráfico de evolución por superficie de la herida.
- Registro de visita con medidas, valoración, apósito, observaciones, fotos antes/después y próxima visita.
- Cola offline para visitas; se sincronizan al recuperar conexión.

## Backend
`AppsScript_Code.gs` ya incluye el spreadsheet de Cuidado de Heridas y las acciones V8. Para usar V8 hay que actualizar el proyecto `Biomedical API` y crear una nueva versión de la implementación web manteniendo la misma URL /exec.

## Enfermeros
La columna `USUARIO_CORE` de la tab ENFERMEROS vincula cada enfermero con `Usuario ID` del Core. Super Admin no necesita vínculo. Para enfermeros normales, completar esta columna antes de pruebas reales.
