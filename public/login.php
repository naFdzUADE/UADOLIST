<?php
// Start session and include required files
session_start();
error_reporting(E_ALL & ~E_DEPRECATED); // Ignore deprecation warnings temporarily

// Include database configuration
require_once '../config/database.php';

// Native redirect function
function redirect($path) {
    header("Location: $path");
    exit;
}

// Si ya hay sesión iniciada, redirige al index usando native path
if (isset($_SESSION['usuario'])) {
    redirect("index.php");
    exit;
}

// Inicializar variables
$error = '';
$bloqueo_activo = false;
$minutos = 0;
$segundos = 0;
$usuario = null;

// Verificar si el usuario está bloqueado por intentos fallidos
if (isset($_SESSION['lockout_time']) && $_SESSION['lockout_time'] > time()) {
    $bloqueo_activo = true;
    $tiempo_restante = $_SESSION['lockout_time'] - time();
    $minutos = floor($tiempo_restante / 60);
    $segundos = $tiempo_restante % 60;
} else {
    // Reset lockout if time has passed
    $_SESSION['lockout_time'] = null;
}

// If not locked out and form submitted
if (!$bloqueo_activo && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create CSRF token if doesn't exist
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    
    // Validate CSRF token
    if (!isset($_POST['csrf_token']) || $_POST['csrf_token'] !== $_SESSION['csrf_token']) {
        $error = "Error de validación. Por favor intente nuevamente.";
    } else {
        // Get user credentials from form
        $username = $_POST['usuario'] ?? '';
        $password = $_POST['password'] ?? '';
        
        // Track login attempts
        if (!isset($_SESSION['login_attempts'])) {
            $_SESSION['login_attempts'] = 0;
        }
        
        // Simple validation
        if (empty($username) || empty($password)) {
            $error = "Por favor complete todos los campos.";
        } else {
            // Query to check credentials
            $query = "SELECT * FROM usuarios WHERE username = :username";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':username', $username);
            $stmt->execute();
            $usuario = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Validate password if user exists
            if ($usuario && password_verify($password, $usuario['password'])) {
                // Successful login
                // SEGURIDAD: Regenerar ID de sesión para prevenir fijación de sesión
                session_regenerate_id(true);
                
                // SEGURIDAD: Resetear contador de intentos
                $_SESSION['login_attempts'] = 0;
                
                // Store user information in session (simplified)
                $_SESSION['usuario'] = $usuario;
                $_SESSION['usuario_id'] = $usuario['id'];
                $_SESSION['rol'] = $usuario['rol'];
                $_SESSION['last_activity'] = time(); // Para timeout de sesión
                
                // Generar nuevo token CSRF después del login
                $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
                
                // Redirect using native path
                redirect("index.php");
                exit;
            } else {
                // Failed login attempt
                $_SESSION['login_attempts']++;
                
                // Lock account after 5 attempts
                if ($_SESSION['login_attempts'] >= 5) {
                    $_SESSION['lockout_time'] = time() + (5 * 60); // 5 minute lockout
                    $bloqueo_activo = true;
                    $minutos = 5;
                    $segundos = 0;
                    $error = "Demasiados intentos fallidos. La cuenta está bloqueada temporalmente.";
                } else {
                    $error = "Usuario o contraseña incorrectos.";
                }
            }
        }
    }
}

// Create CSRF token if needed
if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-Frame-Options" content="DENY">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <title>Login - UAdoList</title>
    
    <!-- Updated favicon paths -->
    <link rel="icon" href="../img/logobg.png?v=<?php echo time(); ?>" type="image/png">
    <link rel="shortcut icon" href="../img/logobg.png?v=<?php echo time(); ?>" type="image/png">
    <link rel="apple-touch-icon" sizes="180x180" href="../img/logobg.png?v=<?php echo time(); ?>">
    <link rel="icon" type="image/png" sizes="32x32" href="../img/logobg.png?v=<?php echo time(); ?>">
    <link rel="icon" type="image/png" sizes="16x16" href="../img/logobg.png?v=<?php echo time(); ?>">
    
    <!-- Force favicon refresh -->
    <meta http-equiv="cache-control" content="no-cache, must-revalidate, post-check=0, pre-check=0">
    <meta http-equiv="pragma" content="no-cache">
    
    <!-- External CSS -->
    <link rel="stylesheet" href="../css/styles.css?v=<?php echo time(); ?>">
</head>
<body>
    <div class="login-container">
        <!-- Updated image path -->
        <img src="../img/logobg.png" alt="Logo" class="login-logo"> 
        <h2>Iniciar Sesión</h2>
        
        <?php if ($bloqueo_activo): ?>
            <div class="error-message">
                Demasiados intentos fallidos. Por favor espere <?php echo $minutos; ?> minutos y <?php echo $segundos; ?> segundos antes de intentar nuevamente.
            </div>
        <?php else: ?>
            <?php if (!empty($error)): ?>
                <p class="error-message"><?php echo htmlspecialchars($error); ?></p>
            <?php endif; ?>
            
            <!-- Updated form action to use current page -->
            <form method="POST" action="<?php echo basename($_SERVER['PHP_SELF']); ?>" autocomplete="off">
                <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                
                <label for="usuario">Usuario:</label>
                <input type="text" id="usuario" name="usuario" required>
                
                <label for="password">Contraseña:</label>
                <input type="password" id="password" name="password" required>
                
                <button type="submit">Entrar</button>
            </form>
        <?php endif; ?>
    </div>
    
    <script>
        // Update logout path
        let timeout;
        function resetTimeout() {
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                window.location.href = "logout.php"; // Using native path for logout
            }, 30 * 60 * 1000); // 30 minutos
        }
        document.addEventListener("mousemove", resetTimeout);
        document.addEventListener("keypress", resetTimeout);
        resetTimeout();
    </script>
</body>
</html>
