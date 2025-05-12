<?php
session_start();
error_reporting(E_ALL & ~E_DEPRECATED);

require_once '../config/database.php';

function redirect($path) {
    header("Location: $path");
    exit;
}

if (isset($_SESSION['usuario_id'])) {
    redirect("index.php");
    exit;
}

$error = '';
$bloqueo_activo = false;
$minutos = 0;
$segundos = 0;
$usuario = null;

if (isset($_SESSION['lockout_time']) && $_SESSION['lockout_time'] > time()) {
    $bloqueo_activo = true;
    $tiempo_restante = $_SESSION['lockout_time'] - time();
    $minutos = floor($tiempo_restante / 60);
    $segundos = $tiempo_restante % 60;
} else {
    $_SESSION['lockout_time'] = null;
}

if (!$bloqueo_activo && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    
    if (!isset($_POST['csrf_token']) || $_POST['csrf_token'] !== $_SESSION['csrf_token']) {
        $error = "Error de validación. Por favor intente nuevamente.";
    } else {
        $username = trim($_POST['usuario'] ?? '');
        $password = $_POST['password'] ?? '';
        if (!isset($_SESSION['login_attempts'])) {
            $_SESSION['login_attempts'] = 0;
        }
        if (empty($username) || empty($password)) {
            $error = "Por favor complete todos los campos.";
        } else {
            $query = "SELECT * FROM usuarios WHERE username = :username";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':username', $username);
            $stmt->execute();
            $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($usuario && password_verify($password, $usuario['password'])) {
                // Successful login
                // SEGURIDAD: Regenerar ID de sesión para prevenir fijación de sesión
                session_regenerate_id(true);
                
                // SEGURIDAD: Resetear contador de intentos
                $_SESSION['login_attempts'] = 0;
                
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
                
                // Bloquear tras 5 attempts
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

if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <title>Login - uaDOList</title>
    
    <!-- Favicon paths -->
    <link rel="icon" href="../img/logobg.png" type="image/png">
    
    <!-- CSS -->
    <link rel="stylesheet" href="../css/styles.css?v=<?php echo time(); ?>">
</head>
    <body class="login-page">
        <div class="login-container">
            
        <img src="../img/logobg.png" alt="Logo uaDOList" class="login-logo">
        <h2>Iniciar Sesión</h2>

            
            <?php if ($bloqueo_activo): ?>
                <div class="error-message">
                    Demasiados intentos fallidos. Por favor espere <?php echo $minutos; ?> minutos y <?php echo $segundos; ?> segundos antes de intentar nuevamente.
                </div>
            <?php else: ?>
                <?php if (!empty($error)): ?>
                    <div class="error-message"><?php echo htmlspecialchars($error); ?></div>
                <?php endif; ?>
                
                <form method="POST" action="<?php echo htmlspecialchars($_SERVER['PHP_SELF']); ?>">
                    <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                    
                    <label for="usuario">Usuario</label>
                    <input type="text" id="usuario" name="usuario" required autofocus>
                    
                    <label for="password">Contraseña</label>
                    <input type="password" id="password" name="password" required>
                    
                    <button type="submit">Iniciar Sesión</button>
                </form>
            <?php endif; ?>
        </div>
    </body>
</html>