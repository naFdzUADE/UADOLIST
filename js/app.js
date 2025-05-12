console.log("App.js script starting");

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded");
    
    const navItems = document.querySelectorAll('.nav-item');
    const viewTitle = document.querySelector('.view-title h2');
    const views = document.querySelectorAll('.view');
    
    const sortSelect = document.getElementById('sortTasks');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const calendarEl = document.getElementById('calendar');
    const pendingTasksEl = document.getElementById('pendingTasks');
    const completedTasksEl = document.getElementById('completedTasks');
    const pendingCountEl = document.getElementById('pendingCount');
    const completedCountEl = document.getElementById('completedCount');
    const tasksListEl = document.getElementById('tasksList');
    const noTasksMessage = document.getElementById('noTasksMessage');
    
    // DOM Elements - Modals
    const taskModal = document.getElementById('taskModal');
    const modalTitle = document.getElementById('modalTitle');
    const taskForm = document.getElementById('taskForm');
    const taskId = document.getElementById('taskId');
    const taskTitle = document.getElementById('taskTitle');
    const taskDescription = document.getElementById('taskDescription');
    const taskDueDate = document.getElementById('taskDueDate');
    const taskStatus = document.getElementById('taskStatus');
    const deleteTaskBtn = document.getElementById('deleteTaskBtn');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    
    const confirmModal = document.getElementById('confirmModal');
    const confirmAction = document.getElementById('confirmAction');
    const cancelAction = document.getElementById('cancelAction');
    
    const toastContainer = document.getElementById('toastContainer');
    
    // State
    let allTasks = [];
    let currentView = 'calendar';
    let currentSort = 'fecha_creacion';
    let calendar;
    let taskToDelete = null;
    
    function validateElements() {
        console.log("Validating DOM elements...");
        
        if (!calendarEl) {
            console.error("Calendar element not found!");
            return false;
        }
        
        if (!taskForm) {
            console.error("Task form not found!");
            return false;
        }
        
        console.log("All critical DOM elements found");
        return true;
    }
    
    // Initialize
    if (!validateElements()) {
        console.error("Initialization aborted due to missing elements");
        return;
    }
    
    initializeApp();
    
    let currentPage = 1;
    let totalPages = 1;
    let tasksPerPage = 50;
    let totalTasks = 0;
    let isLoading = false;
    
    function fetchTasks(page = 1) {
        if (isLoading) return;
        isLoading = true;
        console.log("Fetching tasks for page", page);
        
        const formData = new FormData();
        formData.append('action', 'get_tasks');
        formData.append('sort_by', currentSort);
        formData.append('page', page);
        formData.append('limit', tasksPerPage);
        
        document.body.style.cursor = 'wait';
        
        fetch('index.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            document.body.style.cursor = 'default';
            isLoading = false;
            
            if (data.success) {
                if (page === 1) {
                    allTasks = data.tasks;
                } else {
                    // Concatenar con los datos existentes si estamos cargando más páginas
                    allTasks = allTasks.concat(data.tasks);
                }
                
                // Actualizar metadata de paginación
                currentPage = data.metadata.page;
                totalPages = data.metadata.pages;
                totalTasks = data.metadata.total;
                
                renderTasks();
                updatePaginationControls();
                
                console.log(`Fetched ${data.tasks.length} tasks (${allTasks.length}/${totalTasks} total)`);
            } else {
                showToast(data.message || 'Error al cargar tareas', 'error');
                console.error("Error fetching tasks:", data.message);
            }
        })
        .catch(error => {
            document.body.style.cursor = 'default';
            isLoading = false;
            console.error('Error fetching tasks:', error);
            showToast('Error de conexión', 'error');
        });
    }
    
    // Función para actualizar controles de paginación
    function updatePaginationControls() {
        const paginationEl = document.getElementById('pagination');
        if (!paginationEl) return;
        
        if (totalPages <= 1) {
            paginationEl.style.display = 'none';
            return;
        }
        
        paginationEl.style.display = 'flex';
        paginationEl.innerHTML = '';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.disabled = currentPage === 1;
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                fetchTasks(currentPage - 1);
            }
        });
        paginationEl.appendChild(prevBtn);
        
        // Información de página actual
        const pageInfo = document.createElement('span');
        pageInfo.className = 'pagination-info';
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
        paginationEl.appendChild(pageInfo);
        
        // Añadir botón de página siguiente
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                fetchTasks(currentPage + 1);
            }
        });
        paginationEl.appendChild(nextBtn);
    }
    

    function saveTask() {
        console.log("Saving task");
        
        // Validar el formulario antes de enviar
        if (!validateTaskForm()) {
            return;
        }
        
        const formData = new FormData(taskForm);
        const isEditing = taskId.value !== '';
        
        if (isEditing) {
            formData.append('action', 'update_task');
            formData.append('task_id', taskId.value);
        } else {
            formData.append('action', 'add_task');
        }
        
        document.body.style.cursor = 'wait';
        
        fetch('index.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            document.body.style.cursor = 'default';
            
            if (data.success) {
                closeAllModals();
                fetchTasks(); 
                
                const message = isEditing ? 'Tarea actualizada correctamente' : 'Tarea agregada correctamente';
                showToast(message, 'success');
            } else {
                showToast(data.message || 'Error al guardar la tarea', 'error');
            }
        })
        .catch(error => {
            document.body.style.cursor = 'default';
            console.error('Error saving task:', error);
            showToast('Error de conexión al guardar', 'error');
        });
    }
    
    // Función para validar el formulario de tareas
    function validateTaskForm() {
        const title = taskTitle.value.trim();
        
        // Validar título vacío
        if (title === '') {
            showToast('El título es obligatorio', 'error');
            taskTitle.focus();
            return false;
        }
        
        // Validar que el título solo contenga letras, números y espacios
        const validTitleRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s]+$/;
        if (!validTitleRegex.test(title)) {
            showToast('El título solo puede contener letras, números y espacios', 'error');
            taskTitle.focus();
            return false;
        }
        
        // Validar longitud máxima del título (opcional, pero recomendado)
        if (title.length > 100) {
            showToast('El título no puede exceder los 100 caracteres', 'error');
            taskTitle.focus();
            return false;
        }
        
        return true;
    }
    
    // Agregar validación en tiempo real al campo de título

    function setupFormValidation() {
        if (taskTitle) {
            taskTitle.addEventListener('input', function() {
                const title = this.value.trim();
                const validTitleRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ\s]*$/;
                
                // Eliminar el mensaje de error anterior
                const existingError = this.parentNode.querySelector('.error-msg');
                if (existingError) {
                    existingError.remove();
                }
                
                // Solo mostrar error si hay texto ingresado y es inválido
                if (title !== '' && !validTitleRegex.test(title)) {
                    this.classList.add('invalid-input');
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'error-msg';
                    errorMsg.textContent = 'Solo letras, números y espacios permitidos';
                    
                    // Mostrar mensaje de error debajo del campo
                    this.parentNode.appendChild(errorMsg);
                } else {
                    this.classList.remove('invalid-input');
                }
            });
            
            // Limpiar el mensaje de error al perder el foco si el campo está vacío
            taskTitle.addEventListener('blur', function() {
                if (this.value.trim() === '') {
                    this.classList.remove('invalid-input');
                    const existingError = this.parentNode.querySelector('.error-msg');
                    if (existingError) {
                        existingError.remove();
                    }
                }
            });
        }
    }
        



    function initializeApp() {
        console.log("Initializing app...");
        
        try {
            // Setup Calendar
            initializeCalendar();
            
            // Setup Event Listeners
            setupEventListeners();
            
            // Fetch Tasks
            fetchTasks();
            console.log("App initialized successfully");
        } catch (error) {
            console.error("Error initializing app:", error);
        }
    }
    
    function setupEventListeners() {
        console.log("Setting up event listeners...");
        
        navItems.forEach(item => {
            item.addEventListener('click', function() {
                const view = this.getAttribute('data-view');
                switchView(view);
            });
        });
        
        sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            renderTasks();
        });
        
        addTaskBtn.addEventListener('click', function() {
            openTaskModal();
        });
        
        taskForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveTask();
        });
        
        deleteTaskBtn.addEventListener('click', function() {
            if (taskId.value) {
                taskToDelete = taskId.value;
                openConfirmModal();
            }
        });
        
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                closeAllModals();
            });
        });
        
        confirmAction.addEventListener('click', function() {
            if (taskToDelete) {
                deleteTask(taskToDelete);
                taskToDelete = null;
                closeAllModals();
            }
        });
        
        cancelAction.addEventListener('click', function() {
            taskToDelete = null;
            closeAllModals();
        });
        
        window.addEventListener('click', function(e) {
            if (e.target === taskModal) {
                closeAllModals();
            }
            if (e.target === confirmModal) {
                closeAllModals();
            }
        });
        setupFormValidation();

        console.log("Event listeners set up successfully");
    }
    
    function initializeCalendar() {
        try {
            calendar = new FullCalendar.Calendar(calendarEl, {
                locale: 'es',
                buttonText: {
                    today: 'Hoy',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día',
                    list: 'Lista'
                },
                allDayText: 'Todo el día',  
                initialView: 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                },
                editable: true,
                selectable: true,
                eventClick: function(info) {
                    const taskId = info.event.id;
                    const task = allTasks.find(t => t.id == taskId);
                    if (task) {
                        openTaskModal(task);
                    }
                },
                select: function(info) {
                    const defaultDate = info.startStr;
                    openTaskModal(null, defaultDate);
                },
                eventDrop: function(info) {
                    const taskId = info.event.id;
                    const newDate = info.event.start.toISOString().split('T')[0];
                    const task = allTasks.find(t => t.id == taskId);
                    
                    if (task) {
                        updateTaskDate(taskId, newDate);
                    }
                },
                eventClassNames: function(arg) {
                    const classes = [];
                    
                    if (arg.event.extendedProps.estado === 'completada') {
                        classes.push('task-completed');
                    }
                    
                    return classes;
                }
            });
            
            calendar.render();
            console.log("Calendar initialized successfully");
        } catch (error) {
            console.error("Error initializing calendar:", error);
            if (calendarEl) {
                calendarEl.innerHTML = '<div class="error-message" style="color: red; padding: 20px; text-align: center;">' +
                    '<h3>Error Initializing Calendar</h3>' +
                    '<p>' + error.message + '</p>' +
                    '</div>';
            }
        }
    }
    
    function fetchTasks() {
        console.log("Fetching tasks...");
        const formData = new FormData();
        formData.append('action', 'get_tasks');
        formData.append('sort_by', currentSort);
        
        fetch('index.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                allTasks = data.tasks;
                renderTasks();
                console.log(`Fetched ${allTasks.length} tasks successfully`);
            } else {
                showToast(data.message || 'Error al cargar tareas', 'error');
                console.error("Error fetching tasks:", data.message);
            }
        })
        .catch(error => {
            console.error('Error fetching tasks:', error);
            showToast('Error de conexión', 'error');
        });
    }

    function renderTasks() {
        const sortedTasks = [...allTasks].sort((a, b) => {
            if (currentSort === 'fecha_limite') {
                if (!a.fecha_limite && !b.fecha_limite) return 0;
                if (!a.fecha_limite) return 1;
                if (!b.fecha_limite) return -1;
                return new Date(a.fecha_limite) - new Date(b.fecha_limite);
            } else if (currentSort === 'estado') {
                return a.estado.localeCompare(b.estado);
            } else {
                return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
            }
        });
        
        if (sortedTasks.length === 0) {
            noTasksMessage.style.display = 'block';
        } else {
            noTasksMessage.style.display = 'none';
        }
        
        switch (currentView) {
            case 'calendar':
                renderCalendarTasks(sortedTasks);
                break;
            case 'board':
                renderBoardTasks(sortedTasks);
                break;
        }
    }
    function renderCalendarTasks(tasks) {
        if (!calendar) {
            console.error("Calendar not initialized when trying to render tasks");
            return;
        }
        
        try {
            calendar.removeAllEvents();
            
            // Aumentar el límite para mostrar más tareas en el calendario
            const maxCalendarEvents = window.currentCalendarLimit || 1000;
            window.currentCalendarLimit = maxCalendarEvents;
            
            // Obtener todas las tareas con fecha
            const tasksWithDate = tasks.filter(task => task.fecha_limite);
            const totalTasksWithDate = tasksWithDate.length;
            
            // Limitar número de eventos mostrados en el calendario
            const calendarTasks = tasksWithDate.slice(0, maxCalendarEvents);
            
            const events = calendarTasks.map(task => ({
                id: task.id,
                title: task.titulo,
                start: task.fecha_limite,
                allDay: true,
                backgroundColor: task.estado === 'completada' ? '#A0A0A0' : '#4CAF50',
                borderColor: task.estado === 'completada' ? '#808080' : '#388E3C',
                textColor: '#FFFFFF',
                extendedProps: {
                    estado: task.estado,
                    descripcion: task.descripcion
                }
            }));
            
            calendar.addEventSource({
                events: events
            });
            
            if (totalTasksWithDate > maxCalendarEvents) {
                const calendarContainer = document.getElementById('calendarView');
                
                const existingInfo = calendarContainer.querySelector('.calendar-more-info');
                if (existingInfo) {
                    existingInfo.remove();
                }
                
                const infoContainer = document.createElement('div');
                infoContainer.className = 'calendar-more-info';
                infoContainer.style.textAlign = 'center';
                infoContainer.style.margin = '10px 0';
                
                const moreInfo = document.createElement('div');
                moreInfo.className = 'more-tasks-info';
                moreInfo.textContent = `Mostrando ${calendarTasks.length} de ${totalTasksWithDate} tareas en el calendario`;
                infoContainer.appendChild(moreInfo);
                
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'load-more-btn';
                loadMoreBtn.textContent = 'Cargar más tareas';
                loadMoreBtn.style.marginTop = '8px';
                
                loadMoreBtn.addEventListener('click', function() {
                    window.currentCalendarLimit += 300;
                    
                    renderCalendarTasks(tasks);
                    
                    showToast(`Se cargaron más tareas en el calendario`, 'success');
                });
                
                infoContainer.appendChild(loadMoreBtn);
                
                calendarContainer.appendChild(infoContainer);
            }
        } catch (error) {
            console.error("Error rendering calendar tasks:", error);
        }
    }    
    function switchView(viewName) {
        console.log(`Switching to ${viewName} view`);
        currentView = viewName;
        navItems.forEach(item => {
            if (item.getAttribute('data-view') === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        if (viewTitle) {
            switch(viewName) {
                case 'calendar':
                    viewTitle.textContent = 'Calendario';
                    break;
                case 'board':
                    viewTitle.textContent = 'Tablero';
                    break;
                // Eliminamos la case 'list'
            }
        }
        views.forEach(view => {
            if (view.id === `${viewName}View`) {
                view.classList.add('active');
            } else {
                view.classList.remove('active');
            }
        });
        renderTasks();
    }    
    function renderBoardTasks(tasks) {
        console.log("Rendering board tasks");
        pendingTasksEl.innerHTML = '';
        completedTasksEl.innerHTML = '';
        
        // Aumentar el límite para mostrar más tareas
        const maxTasksPerColumn = 200; // Mantenemos este límite inicial
        
        // Limitar número de tareas por columna
        const pendingTasks = tasks.filter(task => task.estado === 'pendiente').slice(0, maxTasksPerColumn);
        const completedTasks = tasks.filter(task => task.estado === 'completada').slice(0, maxTasksPerColumn);
        
        if (pendingCountEl) pendingCountEl.textContent = tasks.filter(task => task.estado === 'pendiente').length;
        if (completedCountEl) completedCountEl.textContent = tasks.filter(task => task.estado === 'completada').length;
        
        // Usar fragmentos de documento para mejorar el rendimiento
        const pendingFragment = document.createDocumentFragment();
        const completedFragment = document.createDocumentFragment();
        
        if (pendingTasks.length === 0) {
            pendingTasksEl.innerHTML = '<div class="empty-column">No hay tareas pendientes</div>';
        } else {
            pendingTasks.forEach(task => {
                pendingFragment.appendChild(createBoardTask(task));
            });
            pendingTasksEl.appendChild(pendingFragment);
            
            // Mostrar mensaje si hay más tareas que no se muestran
            const totalPending = tasks.filter(task => task.estado === 'pendiente').length;
            if (totalPending > maxTasksPerColumn) {
                const moreInfo = document.createElement('div');
                moreInfo.className = 'more-tasks-info';
                moreInfo.textContent = `Mostrando ${maxTasksPerColumn} de ${totalPending} tareas pendientes`;
                pendingTasksEl.appendChild(moreInfo);
                
                // Añadir botón para cargar más tareas pendientes
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'load-more-btn';
                loadMoreBtn.textContent = 'Cargar más tareas';
                loadMoreBtn.addEventListener('click', function() {
                    // Aumentar el límite y volver a renderizar
                    const currentLimit = parseInt(this.dataset.limit || maxTasksPerColumn);
                    const newLimit = currentLimit + 100; // Cargar 100 más
                    this.dataset.limit = newLimit;
                    
                    // Mostrar las tareas adicionales
                    const additionalTasks = tasks.filter(task => task.estado === 'pendiente')
                        .slice(currentLimit, newLimit);
                    
                    if (additionalTasks.length > 0) {
                        const addFragment = document.createDocumentFragment();
                        additionalTasks.forEach(task => {
                            addFragment.appendChild(createBoardTask(task));
                        });
                        
                        // Insertar antes del mensaje de información
                        moreInfo.parentNode.insertBefore(addFragment, moreInfo);
                        
                        // Actualizar mensaje
                        const newShowing = Math.min(newLimit, totalPending);
                        moreInfo.textContent = `Mostrando ${newShowing} de ${totalPending} tareas pendientes`;
                        
                        // Si ya mostramos todas, ocultar el botón
                        if (newShowing >= totalPending) {
                            this.style.display = 'none';
                        }
                    } else {
                        this.style.display = 'none';
                    }
                });
                pendingTasksEl.appendChild(loadMoreBtn);
            }
        }
        
        if (completedTasks.length === 0) {
            completedTasksEl.innerHTML = '<div class="empty-column">No hay tareas completadas</div>';
        } else {
            completedTasks.forEach(task => {
                completedFragment.appendChild(createBoardTask(task));
            });
            completedTasksEl.appendChild(completedFragment);
            
            // Mostrar mensaje si hay más tareas que no se muestran
            const totalCompleted = tasks.filter(task => task.estado === 'completada').length;
            if (totalCompleted > maxTasksPerColumn) {
                const moreInfo = document.createElement('div');
                moreInfo.className = 'more-tasks-info';
                moreInfo.textContent = `Mostrando ${maxTasksPerColumn} de ${totalCompleted} tareas completadas`;
                completedTasksEl.appendChild(moreInfo);
                
                // Añadir botón para cargar más tareas completadas
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'load-more-btn';
                loadMoreBtn.textContent = 'Cargar más tareas';
                loadMoreBtn.addEventListener('click', function() {
                    // Aumentar el límite y volver a renderizar
                    const currentLimit = parseInt(this.dataset.limit || maxTasksPerColumn);
                    const newLimit = currentLimit + 100; // Cargar 100 más
                    this.dataset.limit = newLimit;
                    
                    // Mostrar las tareas adicionales
                    const additionalTasks = tasks.filter(task => task.estado === 'completada')
                        .slice(currentLimit, newLimit);
                    
                    if (additionalTasks.length > 0) {
                        const addFragment = document.createDocumentFragment();
                        additionalTasks.forEach(task => {
                            addFragment.appendChild(createBoardTask(task));
                        });
                        
                        // Insertar antes del mensaje de información
                        moreInfo.parentNode.insertBefore(addFragment, moreInfo);
                        
                        // Actualizar mensaje
                        const newShowing = Math.min(newLimit, totalCompleted);
                        moreInfo.textContent = `Mostrando ${newShowing} de ${totalCompleted} tareas completadas`;
                        
                        // Si ya mostramos todas, ocultar el botón
                        if (newShowing >= totalCompleted) {
                            this.style.display = 'none';
                        }
                    } else {
                        this.style.display = 'none';
                    }
                });
                completedTasksEl.appendChild(loadMoreBtn);
            }
        }
    }
    
    function createBoardTask(task) {
        const taskEl = document.createElement('div');
        taskEl.className = `board-task ${task.estado === 'completada' ? 'completed' : ''}`;
        taskEl.dataset.id = task.id;
        const formattedDate = task.fecha_limite 
            ? new Date(task.fecha_limite).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short'
              })
            : 'Sin fecha';
        
        taskEl.innerHTML = `
            <div class="task-header">
                <div class="task-title-wrapper">
                    <div class="task-status">
                        <input type="checkbox" class="status-checkbox" ${task.estado === 'completada' ? 'checked' : ''}>
                    </div>
                    <h4>${escapeHtml(task.titulo)}</h4>
                </div>
                <div class="task-actions">
                    <button class="action-btn edit-task" aria-label="Editar tarea">
                        <i class="fas fa-pencil"></i>
                    </button>
                    <button class="action-btn delete-task" aria-label="Eliminar tarea">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="task-body">
                ${task.descripcion ? `<p class="task-desc">${escapeHtml(task.descripcion)}</p>` : ''}
                <div class="task-date">
                    <i class="far fa-calendar-alt"></i> ${formattedDate}
                </div>
            </div>
        `;
        
        taskEl.addEventListener('click', (e) => {
            if (!e.target.closest('.status-checkbox') && 
                !e.target.closest('.action-btn')) {
                openTaskModal(task);
            }
        });
        
        const checkbox = taskEl.querySelector('.status-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', function(e) {
                e.stopPropagation(); 
                const newStatus = this.checked ? 'completada' : 'pendiente';
                updateTaskStatus(task.id, newStatus);
            });
        }
        
        const editBtn = taskEl.querySelector('.edit-task');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openTaskModal(task);
            });
        }
        
        const deleteBtn = taskEl.querySelector('.delete-task');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                taskToDelete = task.id;
                openConfirmModal();
            });
        }
        
        return taskEl;
    }    
    function renderListTasks(tasks) {
        console.log("Rendering list tasks");
        
        tasksListEl.innerHTML = '';
        
        if (tasks.length === 0) {
            noTasksMessage.style.display = 'block';
            return;
        }
        
        noTasksMessage.style.display = 'none';
        
        // Limitar número inicial de tareas
        const maxListTasks = 200;
        const displayTasks = tasks.slice(0, maxListTasks);
        
        // Usar fragmento de documento para mejor rendimiento
        const fragment = document.createDocumentFragment();
        
        displayTasks.forEach(task => {
            fragment.appendChild(createListTask(task));
        });
        
        tasksListEl.appendChild(fragment);
        
        // Mostrar mensaje si hay más tareas que no se muestran
        if (tasks.length > maxListTasks) {
            const moreInfo = document.createElement('div');
            moreInfo.className = 'more-tasks-info';
            moreInfo.textContent = `Mostrando ${maxListTasks} de ${tasks.length} tareas`;
            tasksListEl.appendChild(moreInfo);
            
            // Añadir botón para cargar más tareas
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'load-more-btn';
            loadMoreBtn.textContent = 'Cargar más tareas';
            loadMoreBtn.dataset.limit = maxListTasks;
            
            loadMoreBtn.addEventListener('click', function() {
                const currentLimit = parseInt(this.dataset.limit);
                const newLimit = currentLimit + 100; // Cargar 100 más cada vez
                this.dataset.limit = newLimit;
                
                // Mostrar las tareas adicionales
                const additionalTasks = tasks.slice(currentLimit, newLimit);
                
                if (additionalTasks.length > 0) {
                    const addFragment = document.createDocumentFragment();
                    additionalTasks.forEach(task => {
                        addFragment.appendChild(createListTask(task));
                    });
                    
                    // Insertar antes del mensaje de información
                    moreInfo.parentNode.insertBefore(addFragment, moreInfo);
                    
                    // Actualizar mensaje
                    const newShowing = Math.min(newLimit, tasks.length);
                    moreInfo.textContent = `Mostrando ${newShowing} de ${tasks.length} tareas`;
                    
                    // Si ya mostramos todas, ocultar el botón
                    if (newShowing >= tasks.length) {
                        this.style.display = 'none';
                    }
                } else {
                    this.style.display = 'none';
                }
            });
            
            tasksListEl.appendChild(loadMoreBtn);
        }
    }
    let currentDisplayedCount = 200;
const incrementAmount = 100;


    function createListTask(task) {
        const taskEl = document.createElement('div');
        taskEl.className = `list-task ${task.estado === 'completada' ? 'completed' : ''}`;
        taskEl.dataset.id = task.id;
        
        const formattedDate = task.fecha_limite 
            ? new Date(task.fecha_limite).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })
            : 'Sin fecha límite';
        
        taskEl.innerHTML = `
            <div class="task-status">
                <input type="checkbox" class="status-checkbox" ${task.estado === 'completada' ? 'checked' : ''}>
            </div>
            <div class="task-content">
                <h4>${escapeHtml(task.titulo)}</h4>
                ${task.descripcion ? `<p class="task-desc">${escapeHtml(task.descripcion)}</p>` : ''}
                <div class="task-meta">
                    <span class="task-date">
                        <i class="far fa-calendar-alt"></i> ${formattedDate}
                    </span>
                    <span class="task-badge ${task.estado === 'completada' ? 'completed' : 'pending'}">
                        ${task.estado === 'completada' ? 'Completada' : 'Pendiente'}
                    </span>
                </div>
            </div>
            <div class="task-actions">
                <button class="action-btn edit-task" aria-label="Editar tarea">
                    <i class="fas fa-pencil"></i>
                </button>
                <button class="action-btn delete-task" aria-label="Eliminar tarea">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        const checkbox = taskEl.querySelector('.status-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                const newStatus = this.checked ? 'completada' : 'pendiente';
                updateTaskStatus(task.id, newStatus);
            });
        }
        
        const editBtn = taskEl.querySelector('.edit-task');
        if (editBtn) {
            editBtn.addEventListener('click', () => openTaskModal(task));
        }
        
        const deleteBtn = taskEl.querySelector('.delete-task');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                taskToDelete = task.id;
                openConfirmModal();
            });
        }
        
        return taskEl;
    }
    
    function openTaskModal(task = null, defaultDate = null) {
        console.log("Opening task modal", task);
        
        taskForm.reset();
    const errorMsgs = document.querySelectorAll('.error-msg');
    errorMsgs.forEach(msg => msg.remove())
    const invalidInputs = document.querySelectorAll('.invalid-input');
    invalidInputs.forEach(input => input.classList.remove('invalid-input'));

        if (task) {
            taskId.value = task.id;
            taskTitle.value = task.titulo;
            taskDescription.value = task.descripcion || '';
            taskDueDate.value = task.fecha_limite || '';
            taskStatus.value = task.estado;
            modalTitle.textContent = 'Editar Tarea';
            deleteTaskBtn.style.display = 'block';
        } else {
            taskId.value = '';
            if (defaultDate) {
                taskDueDate.value = defaultDate;
            }
            modalTitle.textContent = 'Nueva Tarea';
            deleteTaskBtn.style.display = 'none';
        }
        
        taskModal.classList.add('active');
        taskModal.querySelector('.modal-content').classList.add('show');
    }
    
    function closeAllModals() {
        taskModal.querySelector('.modal-content').classList.remove('show');
        taskModal.classList.remove('active');
        
        const errorMsgs = document.querySelectorAll('.error-msg');
        errorMsgs.forEach(msg => msg.remove());
        
        const invalidInputs = document.querySelectorAll('.invalid-input');
        invalidInputs.forEach(input => input.classList.remove('invalid-input'));
        
        if (confirmModal.querySelector('.modal-content')) {
            confirmModal.querySelector('.modal-content').classList.remove('show');
        }
        confirmModal.classList.remove('active');
    }
    
        
    function openConfirmModal() {
        confirmModal.classList.add('active');
        confirmModal.querySelector('.modal-content').classList.add('show');
    }
    
    function saveTask() {
        console.log("Saving task");
        
        const formData = new FormData(taskForm);
        const isEditing = taskId.value !== '';
        
        if (isEditing) {
            formData.append('action', 'update_task');
            formData.append('task_id', taskId.value);
        } else {
            formData.append('action', 'add_task');
        }
        
        document.body.style.cursor = 'wait';
        
        fetch('index.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            document.body.style.cursor = 'default';
            
            if (data.success) {
                closeAllModals();
                fetchTasks(); 
                
                const message = isEditing ? 'Tarea actualizada correctamente' : 'Tarea agregada correctamente';
                showToast(message, 'success');
            } else {
                showToast(data.message || 'Error al guardar la tarea', 'error');
            }
        })
        .catch(error => {
            document.body.style.cursor = 'default';
            console.error('Error saving task:', error);
            showToast('Error de conexión al guardar', 'error');
        });
    }
    
    function deleteTask(taskId) {
        console.log("Deleting task", taskId);
        
        const formData = new FormData();
        formData.append('action', 'delete_task');
        formData.append('task_id', taskId);
        
        document.body.style.cursor = 'wait';
        
        fetch('index.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            document.body.style.cursor = 'default';
            
            if (data.success) {
                fetchTasks();
                showToast('Tarea eliminada correctamente', 'success');
            } else {
                showToast(data.message || 'Error al eliminar la tarea', 'error');
            }
        })
        .catch(error => {
            document.body.style.cursor = 'default';
            console.error('Error deleting task:', error);
            showToast('Error de conexión al eliminar', 'error');
        });
    }
    
    function updateTaskStatus(taskId, newStatus) {
        console.log("Updating task status", taskId, newStatus);
        
        const formData = new FormData();
        formData.append('action', 'update_task_status');
        formData.append('task_id', taskId);
        formData.append('estado', newStatus);
        
        document.body.style.cursor = 'wait';
        
        fetch('index.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            document.body.style.cursor = 'default';
            
            if (data.success) {
                fetchTasks(); 
                showToast('Estado actualizado', 'success');
            } else {
                showToast(data.message || 'Error al actualizar estado', 'error');
            }
        })
        .catch(error => {
            document.body.style.cursor = 'default';
            console.error('Error updating status:', error);
            showToast('Error de conexión al actualizar', 'error');
        });
    }
    
    function updateTaskDate(taskId, newDate) {
        console.log("Updating task date", taskId, newDate);
        
        const task = allTasks.find(t => t.id == taskId);
        if (!task) return;
        
        const formData = new FormData();
        formData.append('action', 'update_task');
        formData.append('task_id', taskId);
        formData.append('titulo', task.titulo);
        formData.append('descripcion', task.descripcion || '');
        formData.append('fecha_limite', newDate);
        formData.append('estado', task.estado);
        
        document.body.style.cursor = 'wait';
        
        fetch('index.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            document.body.style.cursor = 'default';
            
            if (data.success) {
                fetchTasks(); 
                showToast('Fecha actualizada', 'success');
            } else {
                showToast(data.message || 'Error al actualizar fecha', 'error');
                if (calendar) calendar.refetchEvents();
            }
        })
        .catch(error => {
            document.body.style.cursor = 'default';
            console.error('Error updating date:', error);
            showToast('Error de conexión al actualizar', 'error');
            if (calendar) calendar.refetchEvents();
        });
    }
    
    function showToast(message, type = 'info') {
        console.log(`Toast: ${message} (${type})`);
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '';
        switch(type) {
            case 'success':
                icon = '<i class="fas fa-check-circle"></i>';
                break;
            case 'error':
                icon = '<i class="fas fa-exclamation-circle"></i>';
                break;
            case 'warning':
                icon = '<i class="fas fa-exclamation-triangle"></i>';
                break;
            default:
                icon = '<i class="fas fa-info-circle"></i>';
        }
        
        toast.innerHTML = `
            ${icon}
            <div class="toast-content">
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
        `;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        return text.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }




    
});