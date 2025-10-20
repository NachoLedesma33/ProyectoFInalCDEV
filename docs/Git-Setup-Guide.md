# Guía para Subir Cambios al Repositorio de GitHub

## 📋 Repositorio Destino
`https://github.com/NachoLedesma33/ProyectoFInalCDEV.git`

## 🔧 Configuración Inicial (Solo primera vez)

### Paso 1: Verificar si Git está instalado
Abre PowerShell en la carpeta del proyecto y ejecuta:

```powershell
git --version
```

Si no tienes Git instalado, descárgalo de: https://git-scm.com/download/win

### Paso 2: Configurar tu identidad Git (si no lo has hecho antes)
```powershell
git config --global user.name "Tu Nombre"
git config --global user.email "tu-email@example.com"
```

### Paso 3: Inicializar el repositorio Git
Desde la carpeta raíz del proyecto (`ProyectoFInalCDEV-main`):

```powershell
# Inicializar repositorio local
git init

# Conectar con el repositorio remoto
git remote add origin https://github.com/NachoLedesma33/ProyectoFInalCDEV.git

# Verificar que se añadió correctamente
git remote -v
```

### Paso 4: Descargar el estado actual del repositorio remoto
```powershell
# Descargar las ramas del repositorio remoto
git fetch origin

# Ver las ramas disponibles
git branch -a
```

### Paso 5: Sincronizar con la rama principal
```powershell
# Si el repositorio remoto tiene una rama 'main'
git branch -M main
git pull origin main --allow-unrelated-histories

# O si usa 'master'
git branch -M master
git pull origin master --allow-unrelated-histories
```

**Nota:** Si hay conflictos, tendrás que resolverlos manualmente.

---

## 📤 Subir Cambios (Cada vez que modificas código)

### Opción A: Usando Comandos de PowerShell

#### 1. Ver archivos modificados
```powershell
git status
```

#### 2. Agregar archivos al stage
```powershell
# Agregar todos los archivos modificados
git add .

# O agregar archivos específicos
git add src/utils/FarmerController.js
git add docs/FarmerController-Optimizations.md
git add docs/S-key-fix-changelog.md
```

#### 3. Hacer commit con un mensaje descriptivo
```powershell
git commit -m "Fix: Corregido comportamiento de tecla S con rotación instantánea 180°"
```

#### 4. Subir cambios al repositorio remoto
```powershell
# Primera vez (establece upstream)
git push -u origin main

# Siguientes veces
git push
```

### Opción B: Usando VS Code (Más visual)

#### 1. Abrir Control de Código Fuente
- Presiona `Ctrl + Shift + G` o haz clic en el ícono de Git en la barra lateral

#### 2. Revisar cambios
- Verás una lista de archivos modificados
- Haz clic en cada archivo para ver los cambios

#### 3. Stage de archivos
- Haz clic en el icono `+` junto a cada archivo para añadirlo al stage
- O haz clic en `+` junto a "Changes" para añadir todos

#### 4. Commit
- Escribe un mensaje descriptivo en el cuadro de texto superior
- Presiona `Ctrl + Enter` o haz clic en el botón de commit (✓)

#### 5. Push
- Haz clic en el botón "..." → "Push"
- O usa el botón "Sync Changes" si aparece

---

## 📝 Ejemplo Completo para tus Cambios Actuales

```powershell
# 1. Navegar a la carpeta del proyecto
cd "c:\Users\tomas\Documents\GitHub\Facultad\Creativ_Des\ProyectoFInalCDEV-main"

# 2. Inicializar Git (solo si no está inicializado)
git init
git remote add origin https://github.com/NachoLedesma33/ProyectoFInalCDEV.git

# 3. Sincronizar con el remoto
git fetch origin
git branch -M main
git pull origin main --allow-unrelated-histories

# 4. Ver archivos modificados
git status

# 5. Agregar los cambios
git add src/utils/FarmerController.js
git add docs/FarmerController-Optimizations.md
git add docs/S-key-fix-changelog.md
git add docs/Git-Setup-Guide.md

# 6. Hacer commit
git commit -m "feat: Mejoras en FarmerController

- Fix: Corregido comportamiento de tecla S (rotación instantánea 180°)
- Docs: Agregada guía de optimizaciones de rendimiento
- Docs: Changelog de corrección de tecla S
- Docs: Guía de configuración de Git"

# 7. Subir cambios
git push -u origin main
```

---

## 🔐 Autenticación en GitHub

### Si pide usuario y contraseña:

1. **NO uses tu contraseña de GitHub** (ya no funciona)
2. Necesitas un **Personal Access Token (PAT)**

### Crear un Personal Access Token:

1. Ve a: https://github.com/settings/tokens
2. Click en "Generate new token (classic)"
3. Nombre: `ProyectoFinalCDEV`
4. Permisos: Marca `repo` (acceso completo)
5. Click en "Generate token"
6. **COPIA EL TOKEN** (no podrás verlo después)
7. Úsalo como contraseña cuando Git te lo pida

### Guardar credenciales (para no escribir el token cada vez):

```powershell
git config --global credential.helper wincred
```

---

## 🚨 Solución de Problemas Comunes

### Problema 1: "Permission denied"
**Solución:** Necesitas permisos de escritura en el repositorio. Contacta a `NachoLedesma33` para que te agregue como colaborador.

### Problema 2: "Failed to push some refs"
**Solución:** Hay cambios en el remoto que no tienes localmente
```powershell
git pull origin main --rebase
git push
```

### Problema 3: "Conflicts during merge"
**Solución:** Resolver conflictos manualmente
1. Abre los archivos con conflictos
2. Busca las marcas `<<<<<<<`, `=======`, `>>>>>>>`
3. Edita para resolver el conflicto
4. Guarda el archivo
5. `git add <archivo-resuelto>`
6. `git commit`
7. `git push`

### Problema 4: "Unrelated histories"
**Solución:** Usa la flag `--allow-unrelated-histories`
```powershell
git pull origin main --allow-unrelated-histories
```

---

## 📊 Comandos Útiles

```powershell
# Ver historial de commits
git log --oneline

# Ver diferencias antes de hacer commit
git diff

# Deshacer el último commit (mantiene cambios)
git reset --soft HEAD~1

# Ver ramas
git branch

# Cambiar de rama
git checkout nombre-rama

# Crear nueva rama
git checkout -b nueva-rama

# Ver configuración
git config --list
```

---

## 🎯 Workflow Recomendado

Para trabajar de forma profesional:

1. **Antes de empezar a trabajar:**
   ```powershell
   git pull origin main
   ```

2. **Durante el desarrollo:**
   - Haz commits frecuentes con mensajes claros
   - Usa prefijos: `feat:`, `fix:`, `docs:`, `refactor:`, etc.

3. **Al terminar una funcionalidad:**
   ```powershell
   git add .
   git commit -m "feat: descripción clara"
   git push
   ```

4. **Para trabajar en una nueva feature:**
   ```powershell
   git checkout -b feature/nombre-feature
   # ... hacer cambios ...
   git add .
   git commit -m "feat: nueva característica"
   git push -u origin feature/nombre-feature
   # Crear Pull Request en GitHub
   ```

---

## 📚 Recursos Adicionales

- **Git Documentation:** https://git-scm.com/doc
- **GitHub Guides:** https://guides.github.com/
- **Git Cheat Sheet:** https://education.github.com/git-cheat-sheet-education.pdf
- **Visual Git Reference:** https://marklodato.github.io/visual-git-guide/index-en.html

---

**Última actualización:** 20 de octubre de 2025
