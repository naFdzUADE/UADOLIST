<?php
session_start();
require_once '../config/database.php';

if (!isset($_SESSION['usuario_id'])) {
    header('Location: login.php');
    exit;
}

$user_id = $_SESSION['usuario_id'];
$user_name = $_SESSION['usuario']['username'] ?? 'Usuario';

// API endpoints handling
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    header('Content-Type: application/json');
    $response = ['success' => false, 'message' => 'Acción no reconocida.'];

    // --- ADD TASK ---
// --- ADD TASK ---
if ($_POST['action'] === 'add_task') {
    $titulo = trim($_POST['titulo'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $fecha_limite = !empty($_POST['fecha_limite']) ? $_POST['fecha_limite'] : null;
    $estado = trim($_POST['estado'] ?? 'pendiente');

    // Validar titulo vacío
    if (empty($titulo)) {
        $response['message'] = 'El título es obligatorio.';
    } 
    // Validar caracteres del titulo
    elseif (!preg_match('/^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s]+$/', $titulo)) {
        $response['message'] = 'El título solo puede contener letras, números y espacios.';
    }
    // Validar longitud max del titulo
    elseif (strlen($titulo) > 100) {
        $response['message'] = 'El título no puede exceder los 100 caracteres.';
    } 
    else {
        try {
            $stmt = $db->prepare("INSERT INTO tareas (usuario_id, titulo, descripcion, fecha_limite, estado) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$user_id, $titulo, $descripcion, $fecha_limite, $estado]);
            $new_task_id = $db->lastInsertId();
            
            $stmt_new = $db->prepare("SELECT id, titulo, descripcion, fecha_limite, estado, DATE_FORMAT(fecha_creacion, '%Y-%m-%d %H:%i:%s') as fecha_creacion FROM tareas WHERE id = ?");
            $stmt_new->execute([$new_task_id]);
            $newTaskData = $stmt_new->fetch(PDO::FETCH_ASSOC);

            $response = ['success' => true, 'message' => 'Tarea agregada.', 'task' => $newTaskData];
        } catch (PDOException $e) {
            error_log("Error al agregar tarea: " . $e->getMessage());
            $response['message'] = 'Error al guardar la tarea.';
        }
    }
}
elseif ($_POST['action'] === 'get_tasks') {
    try {
        $orderBy = "ORDER BY fecha_creacion DESC"; 
        if (isset($_POST['sort_by'])) {
            if ($_POST['sort_by'] === 'fecha_limite') {
                $orderBy = "ORDER BY CASE WHEN fecha_limite IS NULL THEN 1 ELSE 0 END, fecha_limite ASC, fecha_creacion DESC";
            } elseif ($_POST['sort_by'] === 'estado') {
                $orderBy = "ORDER BY estado ASC, CASE WHEN fecha_limite IS NULL THEN 1 ELSE 0 END, fecha_limite ASC, fecha_creacion DESC";
            }
        }
        
        // Primero obtener el total de registros para metadata
        $stmt_count = $db->prepare("SELECT COUNT(*) as total FROM tareas WHERE usuario_id = ?");
        $stmt_count->execute([$user_id]);
        $total = $stmt_count->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Recuperar todas las tareas sin límite para mejorar la experiencia de usuario
        // En un entorno de producción con más datos, se debería implementar paginación completa
        $stmt = $db->prepare("SELECT id, titulo, descripcion, fecha_limite, estado, DATE_FORMAT(fecha_creacion, '%Y-%m-%d %H:%i:%s') as fecha_creacion FROM tareas WHERE usuario_id = ? {$orderBy}");
        $stmt->execute([$user_id]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $response = [
            'success' => true, 
            'tasks' => $tasks,
            'metadata' => [
                'total' => $total
            ]
        ];
    } catch (PDOException $e) {
        error_log("Error al obtener tareas: " . $e->getMessage());
        $response['message'] = 'Error al obtener las tareas.';
    }
}

elseif ($_POST['action'] === 'update_task') {
        $task_id = filter_input(INPUT_POST, 'task_id', FILTER_VALIDATE_INT);
        $titulo = trim($_POST['titulo'] ?? '');
        $descripcion = trim($_POST['descripcion'] ?? '');
        $fecha_limite = !empty($_POST['fecha_limite']) ? $_POST['fecha_limite'] : null;
        $estado = trim($_POST['estado'] ?? 'pendiente');
    
        // Validar ID de tarea
        if (!$task_id) {
            $response['message'] = 'ID de tarea inválido.';
        } 
        // Validar título vacío
        elseif (empty($titulo)) {
            $response['message'] = 'El título es obligatorio.';
        } 
        // Validar caracteres del título (solo letras, números y espacios)
        elseif (!preg_match('/^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s]+$/', $titulo)) {
            $response['message'] = 'El título solo puede contener letras, números y espacios.';
        }
        // Validar longitud máxima del título
        elseif (strlen($titulo) > 100) {
            $response['message'] = 'El título no puede exceder los 100 caracteres.';
        } 
        // Validar estado
        elseif (!in_array($estado, ['pendiente', 'completada'])) {
            $response['message'] = 'Estado inválido.';
        } 
        else {
            try {
                $stmt = $db->prepare("UPDATE tareas SET titulo = ?, descripcion = ?, fecha_limite = ?, estado = ? WHERE id = ? AND usuario_id = ?");
                $stmt->execute([$titulo, $descripcion, $fecha_limite, $estado, $task_id, $user_id]);
                
                if ($stmt->rowCount() > 0 || true) { // Always return task data even if no changes
                    $stmt_updated = $db->prepare("SELECT id, titulo, descripcion, fecha_limite, estado, DATE_FORMAT(fecha_creacion, '%Y-%m-%d %H:%i:%s') as fecha_creacion FROM tareas WHERE id = ?");
                    $stmt_updated->execute([$task_id]);
                    $updatedTaskData = $stmt_updated->fetch(PDO::FETCH_ASSOC);
                    $response = ['success' => true, 'message' => 'Tarea actualizada.', 'task' => $updatedTaskData];
                } else {
                    $response['message'] = 'No se pudo actualizar la tarea o no hubo cambios.';
                }
            } catch (PDOException $e) {
                error_log("Error al actualizar tarea: " . $e->getMessage());
                $response['message'] = 'Error al actualizar la tarea.';
            }
        }
    }
        elseif ($_POST['action'] === 'update_task_status') {
        $task_id = filter_input(INPUT_POST, 'task_id', FILTER_VALIDATE_INT);
        $estado = trim($_POST['estado'] ?? 'pendiente');
        
        if (!$task_id || !in_array($estado, ['pendiente', 'completada'])) {
            $response['message'] = 'Datos inválidos.';
        } else {
            try {
                $stmt = $db->prepare("UPDATE tareas SET estado = ? WHERE id = ? AND usuario_id = ?");
                $stmt->execute([$estado, $task_id, $user_id]);
                $response = ['success' => $stmt->rowCount() > 0, 'message' => $stmt->rowCount() > 0 ? 'Estado actualizado.' : 'No se pudo actualizar.'];
            } catch (PDOException $e) {
                $response['message'] = 'Error al actualizar estado.';
            }
        }
    }
    elseif ($_POST['action'] === 'delete_task') {
        $task_id = filter_input(INPUT_POST, 'task_id', FILTER_VALIDATE_INT);
        
        if (!$task_id) {
            $response['message'] = 'ID de tarea inválido.';
        } else {
            try {
                $stmt = $db->prepare("DELETE FROM tareas WHERE id = ? AND usuario_id = ?");
                $stmt->execute([$task_id, $user_id]);
                $response = ['success' => $stmt->rowCount() > 0, 'message' => $stmt->rowCount() > 0 ? 'Tarea eliminada.' : 'No se pudo eliminar.'];
            } catch (PDOException $e) {
                $response['message'] = 'Error al eliminar la tarea.';
            }
        }
    }
    
    echo json_encode($response);
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>uaDOList</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="../img/logobg.png" type="image/png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="../css/styles.css?v=<?php echo time(); ?>">
</head>
<body class="app-layout">
    <div class="app-container">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="logo-container">
                <img src="../img/logobg.png" alt="UAdoList Logo" class="logo">
                <h1>uaDOList</h1>
            </div>
            
            <nav class="main-nav">
                <button class="nav-item active" data-view="calendar">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Calendario</span>
                </button>
                <button class="nav-item" data-view="board">
                    <i class="fas fa-columns"></i>
                    <span>Tablero</span>
                </button>
            </nav>
            
            <div class="user-section">
                <div class="user-info">
                    <i class="fas fa-user-circle"></i>
                    <span><?php echo htmlspecialchars($user_name); ?></span>
                </div>
                <a href="logout.php" class="logout-button">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Cerrar sesión</span>
                </a>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            <header class="content-header">
                <div class="view-title">
                    <h2>Calendario</h2>
                </div>
                <div class="header-actions">
                    <div class="sort-options">
                        <label for="sortTasks">Ordenar por:</label>
                        <select id="sortTasks" class="sort-select">
                            <option value="fecha_creacion">Fecha Creación</option>
                            <option value="fecha_limite">Fecha Límite</option>
                            <option value="estado">Estado</option>
                        </select>
                    </div>
                    <button id="addTaskBtn" class="btn-primary">
                        <i class="fas fa-plus"></i> Nueva Tarea
                    </button>
                </div>
            </header>
            
            <div class="views-container">
                <div id="calendarView" class="view active">
                    <div id="calendar"></div>
                </div>
                
                <div id="boardView" class="view">
                    <div class="board-columns">
                        <div class="board-column" data-status="pendiente">
                            <div class="column-header">
                                <h3>Pendientes</h3>
                                <span class="task-count" id="pendingCount">0</span>
                            </div>
                            <div class="column-tasks" id="pendingTasks">
                            </div>
                        </div>
                        <div class="board-column" data-status="completada">
                            <div class="column-header">
                                <h3>Completadas</h3>
                                <span class="task-count" id="completedCount">0</span>
                            </div>
                            <div class="column-tasks" id="completedTasks">
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- List View -->
                <div id="listView" class="view">
                    <div class="list-container">
                        <div id="tasksList" class="tasks-list">
                        </div>
                        <p id="noTasksMessage" class="no-tasks-message">No tienes tareas pendientes. ¡Agrega una!</p>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <!-- Task Modal -->
    <div id="taskModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="modalTitle">Nueva Tarea</h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="taskForm">
                <input type="hidden" id="taskId" name="task_id">
                <div class="form-group">
                    <label for="taskTitle">Título<span class="required">*</span></label>
                    <input type="text" id="taskTitle" name="titulo" required>
                </div>
                <div class="form-group">
                    <label for="taskDescription">Descripción</label>
                    <textarea id="taskDescription" name="descripcion"></textarea>
                </div>
                <div class="form-group">
                    <label for="taskDueDate">Fecha Límite</label>
                    <input type="date" id="taskDueDate" name="fecha_limite">
                </div>
                <div class="form-group">
                    <label for="taskStatus">Estado</label>
                    <select id="taskStatus" name="estado">
                        <option value="pendiente">Pendiente</option>
                        <option value="completada">Completada</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" id="deleteTaskBtn" class="btn-danger">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                </div>
            </form>
        </div>
    </div>
    
    <!-- Confirmation Modal -->
    <div id="confirmModal" class="modal confirm-modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Confirmar Acción</h3>
                <button class="close-modal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="confirm-message">
                ¿Estás seguro de que deseas eliminar esta tarea?
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" id="cancelAction">Cancelar</button>
                <button class="btn-danger" id="confirmAction">Eliminar</button>
            </div>
        </div>
    </div>
    
    <!-- Toast Notifications -->
    <div id="toastContainer" class="toast-container"></div>
    
    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/dist/index.global.js"></script>
    <script src="../js/app.js?v=<?php echo time(); ?>"></script></body>
</html>