# V7 Integration — conexión real

La V7 BASE APROBADA queda intacta. Esta carpeta es la versión de integración.

## Google Sheets verificados — cuenta Biomedical

Este paquete ya apunta EXCLUSIVAMENTE a las nuevas copias del Drive de Biomedical:

- Core / Administración: `1B4CA6eYG8Eo0iw5Jirqbtysel9nFAlp293rJITnFJiM`
- Control de Entrega de Materiales: `18qKIsPQ3ltFuuLewgfDKwKlw9HvOsvK0jvUMHxD0ZfM`
- Cuidado de Heridas: `1zUggMsqKWHo1msYvK5W8xl2h2nYbamgiQk4xVRfmDDs` (todavía no conectado)

Se verificaron Usuarios, Sectores, Permisos y las 26 columnas de Entregas.

## Ya preparado en Google Sheets
El Core tiene usuarios demo y permisos para Control de Entrega de Materiales.
El spreadsheet operativo tiene las columnas necesarias para la interfaz aprobada.

## Paso manual necesario: publicar el backend
1. Abrí script.google.com con la cuenta de Biomedical.
2. Nuevo proyecto: `Biomedical API`.
3. Borrá el contenido de `Code.gs`.
4. Copiá TODO el contenido de `AppsScript_Code.gs` de este paquete y pegalo en `Code.gs`.
5. Guardá.
6. Implementar > Nueva implementación.
7. Tipo: Aplicación web.
8. Ejecutar como: vos / propietario del proyecto.
9. Quién tiene acceso: la opción que permita usar la app a los empleados previstos. Para la prueba inicial, usar el alcance más amplio permitido por la cuenta Workspace.
10. Implementar y autorizar los permisos solicitados para Sheets/Drive.
11. Copiá la URL que termina en `/exec`.
12. Abrí `config.js` y pegala en `API_URL`.
13. Subí los archivos web actualizados a GitHub.

## Qué hace el backend
- Valida usuario + código desde Core / Usuarios.
- Lee rol y sectores desde Core.
- Lee entregas desde el spreadsheet operativo.
- Super Admin puede consultar todo.
- Operadores reciben sus asignadas y su historial.
- Actualiza Retirado / Entregado / Recibido por / Sector / Nota.
- Guarda foto del remito en una carpeta Drive `Biomedical — Remitos App` y devuelve su URL.

## Siguiente etapa
Con la URL `/exec` real, se termina de sustituir la fuente demo de `app.js` por llamadas a `api.js` y se prueba el circuito completo.
