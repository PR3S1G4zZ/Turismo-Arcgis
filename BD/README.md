# BD — Base de datos (MySQL)

Scripts SQL de la base de datos **`turismo_itagui`**.

## Archivos

- **`schema.sql`** — Crea la base de datos, todas las tablas (`users`, `sites`,
  `announcements`, `events`, `pqrs`, `settings`, `visit_log`) y el
  super-administrador inicial. Es idempotente (se puede ejecutar varias veces).

## Cómo ejecutarlo

Desde la terminal (te pedirá la contraseña de MySQL):

```bash
mysql -u root -p < BD/schema.sql
```

O dentro del cliente `mysql` ya conectado:

```sql
SOURCE C:/Users/Usuario/Desktop/Turismo-Itagui/BD/schema.sql;
```

## Nota

El backend (`backend/src/db.js`, función `initDb`) crea **todo esto
automáticamente** al arrancar, así que en desarrollo no hace falta correr el
script a mano. Se incluye para desplegar o inspeccionar la base de datos
manualmente, por ejemplo en el servidor de la **Alcaldía de Itagüí**.

## Credenciales iniciales

| usuario | contraseña           | rol        |
|---------|----------------------|------------|
| `admin` | `Itagui2026*Cambiar` | superadmin |

> ⚠️ Cambia la contraseña tras el primer inicio de sesión.
