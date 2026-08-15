# Biomedical — V6 Clean Demo

Rebuild limpio desde la V4 visual.

## Sol Demo
Sol Demo / 2468 es Super Admin.

Dentro de Control de Entrega de Materiales, las dos herramientas exclusivas se muestran juntas en un bloque amarillo, sin texto “Super Admin”:
- Gestionar entrega de otro usuario
- Encontrar registro

## Encontrar registro
Sólo consulta.
- Busca por remito, sanatorio, material, médico o paciente.
- Filtros por estado y usuario.
- Sólo muestra “Ver detalle”; no permite cambiar estados.
- Al volver del detalle regresa a la búsqueda y conserva el texto/filtros/resultados.

## Gestionar entrega de otro usuario
- Busca por número de remito o paciente.
- Devuelve coincidencias pendientes asignadas a otros usuarios.
- Al seleccionar una entrega, muestra todos sus datos y sí permite avanzar el flujo.

## Entrega
Datos precargados:
- remito
- material
- sanatorio
- paciente
- médico

Al completar:
- Recibido por
- Sector
- Nota opcional
- Foto obligatoria del remito

Las notas también pueden venir precargadas y son visibles en la consulta general.

## Datos demo
V6 usa una clave nueva `recordsV6`, para no reutilizar los registros guardados por versiones anteriores.
