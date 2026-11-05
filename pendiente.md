# Pendientes de configuración

## 1. Configuración en Android (Tasker / MacroDroid)

Configurar en el celular el disparador para cuando salgas de tu casa rumbo al trabajo.

URL de producción de tu backend:
`https://travel-time-eta.vercel.app/api/travel-time`

---

### Opción A: Tasker

1. **Crear Perfil:**
   - Tocar en `+` > **Estado** > **Red** > **Wi-Fi Conectado**.
   - En **SSID**, escribir o seleccionar la red Wi-Fi de tu casa.
   - Marcar la casilla **Invertir** (para que se active al desconectarte de esa red).
2. **Agregar restricciones horarias al Perfil:**
   - Mantener presionado sobre la condición del perfil recién creado > **Añadir**.
   - Seleccionar **Día** > Marcar únicamente **Lunes** y **Jueves**.
   - Mantener presionado de nuevo > **Añadir** > **Hora** > Desde: `06:30`, Hasta: `08:30`.
3. **Crear la Tarea asociada:**
   - Acción 1: **Tarea** > **Esperar** > Configurar `1 minuto` (espera a que el teléfono tome señal móvil 4G/5G).
   - Acción 2: **Red** > **Petición HTTP**:
     - **Método:** `POST`
     - **URL:** `https://travel-time-eta.vercel.app/api/travel-time`
     - **Tiempo de espera (segundos):** `30`

---

### Opción B: MacroDroid

1. **Disparador:**
   - `+` > **Conectividad** > **Estado del Wi-Fi** > **Desconectado de la red**.
   - Elegir el SSID del Wi-Fi de tu casa.
2. **Restricciones del macro:**
   - `+` > **Fecha / Hora** > **Día de la semana** > Lunes y Jueves.
   - `+` > **Fecha / Hora** > **Hora del día** > Rango `06:30` a `08:30`.
3. **Acciones:**
   - `+` > **Condiciones / Bucles** > **Esperar antes de la siguiente acción** > `1 minuto`.
   - `+` > **Conectividad** > **Petición HTTP**:
     - **Método:** `POST`
     - **URL:** `https://travel-time-eta.vercel.app/api/travel-time`
