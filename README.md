# HONOR · Formularios QR

Aplicación para crear formularios dinámicos, publicarlos con un código QR y recibir respuestas de cualquier persona, sin cuenta. Cada respuesta se guarda al instante en una lista de SharePoint, y cada formulario tiene su propio tablero de indicadores.

## Qué hay en la carpeta

| Ruta | Para qué sirve |
|---|---|
| `public/index.html` | Inicio de sesión del administrador |
| `public/admin/` | Panel: crear formularios, descargar el QR, ver los indicadores |
| `public/f/` | El formulario que abre el QR, pensado para celular |
| `public/assets/` | Logos de HONOR, estilos y el renderizador de formularios |
| `netlify/functions/` | La API: ingreso, formularios públicos y panel |
| `netlify/lib/` | Conexión con SharePoint (Microsoft Graph) y manejo de la sesión |
| `netlify.toml` | Configuración de Netlify |
| `.env.example` | Lista de variables que debes crear en Netlify |

## Antes de empezar: no uses «arrastrar y soltar»

Netlify Drop, la opción de arrastrar la carpeta al navegador, **solo publica archivos estáticos y no instala las funciones**. Sin ellas, el ingreso y la conexión con SharePoint no funcionan.

Usa una de estas dos opciones.

**Opción A: con GitHub (recomendada).**

1. Sube esta carpeta a un repositorio de GitHub. Puede ser privado.
2. En Netlify, elige **Add new site → Import an existing project** y selecciona el repositorio.
3. Netlify lee `netlify.toml` solo. No hay que cambiar nada en la configuración de compilación.

**Opción B: con la línea de comandos de Netlify.**

```
npm install -g netlify-cli
cd honor-formularios
netlify login
netlify init          # crea o vincula el sitio
netlify deploy --prod
```

## Paso 1. Variables de entorno en Netlify

En el sitio, ve a **Site configuration → Environment variables → Add a variable**. Crea estas variables:

| Variable | Valor |
|---|---|
| `ADMIN_USER` | `1095841966` |
| `ADMIN_PASSWORD` | `123456` |
| `SESSION_SECRET` | Un texto largo y aleatorio, de al menos 32 caracteres |
| `TENANT_ID` | Id. de directorio (inquilino) de Microsoft |
| `CLIENT_ID` | Id. de la aplicación registrada en Microsoft |
| `CLIENT_SECRET` | Secreto de esa aplicación |
| `SITE_ID` | Id del sitio de SharePoint (paso 3) |

Para generar `SESSION_SECRET`, sirve cualquier frase larga sin sentido. También puedes ejecutar este comando:

```
openssl rand -hex 32
```

**Después de crear o cambiar variables, vuelve a publicar el sitio.** Se hace desde **Deploys → Trigger deploy**.

### Sobre el usuario y la contraseña

- El usuario `1095841966` es el administrador.
- Los datos de acceso viven solo en Netlify. No están escritos en el código ni en las páginas que se publican.
- Para cambiar la contraseña, edita `ADMIN_PASSWORD` y vuelve a publicar.
- **Cambia `123456` por una contraseña fuerte antes de usar la app en la operación real.**
- La sesión dura 8 horas.
- Después de 10 intentos fallidos desde la misma conexión, el ingreso se bloquea 15 minutos.

## Paso 2. Registrar la aplicación en Microsoft (lo hace TI)

1. En el portal de Azure, ve a **Microsoft Entra ID → Registros de aplicaciones → Nuevo registro**. Ponle el nombre «HONOR Formularios QR».
2. Anota el **Id. de aplicación (cliente)** y el **Id. de directorio (inquilino)**.
3. Ve a **Permisos de API → Microsoft Graph → Permisos de aplicación**. Elige **Sites.Selected** y luego **Conceder consentimiento de administrador**.
4. Ve a **Certificados y secretos → Nuevo secreto de cliente** y copia el valor.

## Paso 3. Autorizar la app sobre el sitio de SharePoint

Abre [Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) con una cuenta de administrador.

**Obtén el id del sitio:**

```
GET https://graph.microsoft.com/v1.0/sites/tuempresa.sharepoint.com:/sites/Formularios
```

**Concede permiso a la app:**

```
POST https://graph.microsoft.com/v1.0/sites/{id-del-sitio}/permissions
{
  "roles": ["manage"],
  "grantedToIdentities": [
    { "application": { "id": "{CLIENT_ID}", "displayName": "HONOR Formularios QR" } }
  ]
}
```

Si tu inquilino no acepta `manage`, usa `fullcontrol`.

## Paso 4. Usarla

1. Abre la dirección de tu sitio en Netlify e ingresa con el usuario y la contraseña.
2. Pulsa **Nuevo formulario**. Ya trae preguntas de ejemplo para una ronda de vigilancia; edítalas a tu gusto.
3. Pulsa **Publicar formulario**. Esto crea su lista en SharePoint.
4. En **QR y SharePoint**, descarga el cartel con el QR y el logo de HONOR, listo para imprimir.
5. En **Indicadores** verás los gráficos. Se actualizan cada minuto.

## Probar en tu computador

```
cp .env.example .env      # completa los valores reales
netlify dev
```

Abre `http://localhost:8888`.

## Cosas a tener en cuenta

- **Tipos de pregunta.** Una vez publicada, el tipo de una pregunta queda fijo, porque ya es una columna en SharePoint. Sí puedes cambiar el texto, las opciones y si es obligatoria.
- **Preguntas eliminadas.** Desaparecen del formulario, pero su columna y sus datos se conservan en la lista.
- **Cerrar un formulario.** Detiene las respuestas sin borrar nada. Se puede reabrir.
- **El enlace del QR.** Lleva una clave aleatoria, así que nadie puede adivinar otros formularios cambiando el número.
- **Volumen de datos.** Los indicadores leen todas las respuestas del formulario. Van bien hasta unos pocos miles. Para más, conecta Power BI a las listas de SharePoint.
