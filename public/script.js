// script.js
const API_URL = 'https://my-gym-app.vercel.app/api/clients';
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const clientListContainer = document.getElementById('client-list');
    const addClientBtn = document.getElementById('add-client-btn');
    const clientCountEl = document.getElementById('client-count');
    const searchBar = document.getElementById('search-bar');
    const loadingSpinner = document.getElementById('loading-spinner');
    // Form Modal Elements
    const formModal = document.getElementById('form-modal');
    const clientForm = document.getElementById('client-form');
    const formModalTitle = document.getElementById('form-modal-title');
    const endDateDisplay = document.getElementById('end-date-display');
    const feeDateInput = document.getElementById('fee-date');
    const monthsInput = document.getElementById('months');
    const clientIdInput = document.getElementById('client-id');
    const aadhaarInput = document.getElementById('aadhaar');
    // Details Modal Elements
    const detailsModal = document.getElementById('details-modal');
    const detailsName = document.getElementById('details-name');
    const detailsContent = document.getElementById('details-content');
    let clients = [];

    // --- UTILITY FUNCTIONS ---
    // A simple custom message box to replace alert/confirm
    const showMessage = (message, type = 'info') => {
        const messageBox = document.createElement('div');
        messageBox.className = `message-box ${type}`;
        messageBox.textContent = message;
        document.body.appendChild(messageBox);
        setTimeout(() => {
            messageBox.remove();
        }, 3000);
    };

    const calculateDaysRemaining = (endDateStr) => {
        const endDate = new Date(endDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        return Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    };

    const formatDate = (date) => new Date(date).toLocaleDateString('en-GB');

    const calculateEndDate = (startDateStr, months) => {
        const startDate = new Date(startDateStr);
        startDate.setMonth(startDate.getMonth() + months);
        return startDate.toISOString().split('T')[0];
    };

    const updateEndDatePreview = () => {
        if (feeDateInput.value && monthsInput.value) {
            const endDate = calculateEndDate(feeDateInput.value, parseInt(monthsInput.value, 10));
            endDateDisplay.textContent = formatDate(endDate);
        } else {
            endDateDisplay.textContent = '--/--/----';
        }
    };

    // ✅ NEW: Medical condition toggle functionality
    const toggleMedicalDetails = () => {
        const medicalYes = document.getElementById('medical-yes');
        const medicalDetailsRow = document.getElementById('medical-details-row');
        const medicalDetailsTextarea = document.getElementById('medical-details');

        if (medicalYes && medicalYes.checked) {
            if (medicalDetailsRow) medicalDetailsRow.style.display = 'block';
            if (medicalDetailsTextarea) medicalDetailsTextarea.required = true;
        } else {
            if (medicalDetailsRow) medicalDetailsRow.style.display = 'none';
            if (medicalDetailsTextarea) {
                medicalDetailsTextarea.required = false;
                medicalDetailsTextarea.value = '';
            }
        }
    };

    // WhatsApp functionality - opens WhatsApp with personalized message
    const openWhatsApp = (contact, name, endDate) => {
	    const cleanContact = contact.replace(/\D/g, '');
	    const phoneNumber = cleanContact.startsWith('91') ? cleanContact : `91${cleanContact}`;
	    const formattedEndDate = new Date(endDate).toLocaleDateString('en-GB');
	    const message = `Hi ${name}, this is from MBFC Gym regarding your membership. Your membership expires on ${formattedEndDate}`;
	    const encodedMessage = encodeURIComponent(message);
	    const whatsappDesktopURL = `whatsapp://send?phone=${phoneNumber}&text=${encodedMessage}`;
	    window.location.href = whatsappDesktopURL;
	};


    // --- API CALLS ---
    // Fetches all clients from the backend
    const fetchClients = async () => {
        try {
            clientListContainer.innerHTML = '';
            clientCountEl.textContent = 'Loading...';
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            clients = await response.json();
            renderClients();
        } catch (error) {
            console.error('Error fetching clients:', error);
            clientListContainer.innerHTML = `<p class="text-center text-red-500">
                Failed to load clients. Please ensure the backend server is running.
            </p>`;
            clientCountEl.textContent = 'Error';
        }
    };

    // ✅ UPDATED: Handles form submission with medical condition data
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const contact = document.getElementById('contact').value;
        const feeDate = document.getElementById('fee-date').value;
        const aadhaar = document.getElementById('aadhaar').value;

        if (new Date(feeDate) > new Date()) {
            showMessage('Fee submission date cannot be in the future.', 'error');
            return;
        }

        // ✅ NEW: Get medical condition data
        const medicalConditionRadio = document.querySelector('input[name="medical-condition"]:checked');
        const hasMedicalCondition = medicalConditionRadio ? medicalConditionRadio.value === 'yes' : false;
        const medicalConditionDetails = hasMedicalCondition ?
            (document.getElementById('medical-details') ? document.getElementById('medical-details').value : '') : '';

        const formData = {
            name: document.getElementById('name').value,
            contact: contact,
            aadhaar: aadhaar,
            heightFt: parseInt(document.getElementById('height-ft').value, 10),
            heightIn: parseInt(document.getElementById('height-in').value, 10),
            weight: parseFloat(document.getElementById('weight').value),
            goal: document.getElementById('goal').value,
            feesSubmitted: parseFloat(document.getElementById('fees-submitted').value),
            feesDue: parseFloat(document.getElementById('fees-due').value),
            pt: document.querySelector('input[name="pt"]:checked').value,
            months: parseInt(document.getElementById('months').value, 10),
            feeDate: feeDate,
            // ✅ NEW: Add medical condition data
            hasMedicalCondition: hasMedicalCondition,
            medicalConditionDetails: medicalConditionDetails
        };

        const clientId = clientIdInput.value;
        let response;

        if (clientId) {
            response = await fetch(API_URL, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: clientId, ...formData })
            });
        } else {
            response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        }

        if (response.ok) {
            showMessage('Client saved successfully!');
            closeAllModals();
            fetchClients();
        } else {
            const error = await response.json();
            showMessage(`Error: ${error.message}`, 'error');
        }
    };

    // Deletes a client from the database
    const handleDelete = async (id) => {
        const confirmed = await window.confirm('Are you sure you want to remove this client?');
        if (!confirmed) return;
        try {
            const response = await fetch(API_URL, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (response.ok) {
                const clientElement = document.querySelector(`.client-item[data-id='${id}']`);
                if (clientElement) {
                    clientElement.classList.add('item-remove-animation');
                    clientElement.addEventListener('animationend', () => {
                        fetchClients();
                    });
                } else {
                    fetchClients();
                }
            } else {
                const error = await response.json();
                showMessage(`Error deleting client: ${error.message}`, 'error');
            }
        } catch (error) {
            showMessage('Error deleting client. Check console for details.', 'error');
            console.error('Delete error:', error);
        }
    };

    // --- CORE RENDERING ---
	const renderClients = () => {
	    const searchTerm = searchBar.value.toLowerCase();
	    clientListContainer.innerHTML = '';
	    const filteredClients = clients.filter(client =>
	        client.name.toLowerCase().includes(searchTerm)
	    );
	    if (filteredClients.length === 0) {
	        clientListContainer.innerHTML = `<p style="text-align:center; color: var(--secondary-text);">No clients found.</p>`;
	    }
	    // Sort by days remaining
	    filteredClients.sort((a, b) => {
	        const daysA = calculateDaysRemaining(a.membership.endDate);
	        const daysB = calculateDaysRemaining(b.membership.endDate);
	        return daysA - daysB;
	    });

	    filteredClients.forEach(client => {
	        const daysRemaining = calculateDaysRemaining(client.membership.endDate);
	        const isOverdue = daysRemaining < 0;
	        const hasFeeDue = client.fees.due > 0;

	        // ✅ UPDATED: Build subheading with medical condition
	        let subheading = `${client.contact} &bull; ${client.goal}`;

	        // Add PT information if exists
	        if (client.pt !== 'None') {
	            subheading += ` &bull; <span class="pt-badge">PT: ${client.pt}</span>`;
	        }

	        // ✅ NEW: Add medical condition if exists (only if "yes")
	        if (client.medicalCondition && client.medicalCondition.hasMedicalCondition) {
	            const medicalText = client.medicalCondition.conditionDetails
	                ? client.medicalCondition.conditionDetails
	                : 'Medical condition noted';
	            subheading += ` &bull; <span class="medical-badge">${medicalText}</span>`;
	        }

	        const clientItem = document.createElement('div');
	        clientItem.className = 'client-item';
	        clientItem.dataset.id = client._id;
	        clientItem.innerHTML = `
	            <div class="client-item-content">
	                <div class="client-info">
	                    <h3>${client.name}</h3>
	                    <p>${subheading}</p>
	                </div>
	                <div class="membership-status">
	                    <div class="status-badges">
	                        ${hasFeeDue ? `<span class="fee-due-badge">Due: ₹${client.fees.due.toFixed(2)}</span>` : ''}
	                        <span class="days-remaining ${isOverdue ? 'overdue' : ''}">
	                            ${isOverdue ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d left`}
	                        </span>
	                    </div>
	                    <button class="whatsapp-btn" title="Message on WhatsApp">
	                        <img src="wp.png" alt="WhatsApp" />
	                    </button>
	                    <button class="edit-btn" title="Edit Client">
	                         <img src="edit.png" alt="Edit" class="edit-icon" />
	                    </button>
	                    <button class="delete-btn" title="Remove Client">
	                         <span class="material-symbols-outlined">delete</span>
	                    </button>
	                </div>
	            </div>
	        `;
	        clientListContainer.appendChild(clientItem);
	    });
	    clientCountEl.textContent = `${filteredClients.length} of ${clients.length} Client${clients.length !== 1 ? 's' : ''}`;
	};


    // ✅ UPDATED: Details modal now shows medical condition
    const openDetailsModal = (id) => {
        const client = clients.find(c => c._id === id);
        if (!client) {
            showMessage('Client not found.', 'error');
            return;
        }

        detailsName.textContent = client.name;

        // ✅ NEW: Handle medical condition display
        const medicalConditionDisplay = client.medicalCondition && client.medicalCondition.hasMedicalCondition
            ? client.medicalCondition.conditionDetails || 'Yes (No details provided)'
            : 'No';

        detailsContent.innerHTML = `
            <div class="detail-item"><strong>Contact</strong><span>${client.contact}</span></div>
            <div class="detail-item"><strong>Aadhaar No.</strong><span>${client.aadhaar || 'N/A'}</span></div>
            <div class="detail-item"><strong>Goal</strong><span>${client.goal}</span></div>
            <div class="detail-item"><strong>Height</strong><span>${client.height.ft}'${client.height.in}"</span></div>
            <div class="detail-item"><strong>Weight</strong><span>${client.weight}kg</span></div>
            <div class="detail-item"><strong>Medical Condition</strong><span>${medicalConditionDisplay}</span></div>
            <div class="detail-item"><strong>Fee Submitted</strong><span>₹${client.fees.submitted.toFixed(2)}</span></div>
            <div class="detail-item"><strong>Fee Due</strong><span>₹${client.fees.due.toFixed(2)}</span></div>
            <div class="detail-item"><strong>Personal Training</strong><span>${client.pt}</span></div>
            <div class="detail-item"><strong>Membership</strong><span>${client.membership.months} Months</span></div>
            <div class="detail-item"><strong>Start Date</strong><span>${formatDate(client.membership.feeDate)}</span></div>
            <div class="detail-item"><strong>End Date</strong><span>${formatDate(client.membership.endDate)}</span></div>
        `;
        detailsModal.classList.remove('hidden');
    };

    // ✅ UPDATED: Form modal now handles medical condition data
    const openFormModal = (client = null) => {
        clientForm.reset();
        clientIdInput.value = '';
        document.getElementById('pt-none').checked = true;
        document.getElementById('fees-due').value = 0;

        // ✅ NEW: Reset medical condition fields
        const medicalNo = document.getElementById('medical-no');
        const medicalDetails = document.getElementById('medical-details');
        if (medicalNo) medicalNo.checked = true;
        if (medicalDetails) medicalDetails.value = '';
        toggleMedicalDetails();

        formModalTitle.textContent = 'New Client';
        updateEndDatePreview();

        if (client) {
            formModalTitle.textContent = 'Edit Client';
            clientIdInput.value = client._id;
            document.getElementById('name').value = client.name;
            document.getElementById('contact').value = client.contact;
            document.getElementById('aadhaar').value = client.aadhaar || '';
            document.getElementById('height-ft').value = client.height.ft;
            document.getElementById('height-in').value = client.height.in;
            document.getElementById('weight').value = client.weight;
            document.getElementById('goal').value = client.goal;
            document.getElementById('fees-submitted').value = client.fees.submitted;
            document.getElementById('fees-due').value = client.fees.due;
            document.querySelector(`input[name="pt"][value="${client.pt}"]`).checked = true;
            document.getElementById('months').value = client.membership.months;
            document.getElementById('fee-date').value = new Date(client.membership.feeDate).toISOString().split('T')[0];

            // ✅ NEW: Populate medical condition data
            const medicalYes = document.getElementById('medical-yes');
            const medicalNo = document.getElementById('medical-no');
            const medicalDetails = document.getElementById('medical-details');

            if (client.medicalCondition && client.medicalCondition.hasMedicalCondition) {
                if (medicalYes) medicalYes.checked = true;
                if (medicalDetails) medicalDetails.value = client.medicalCondition.conditionDetails || '';
            } else {
                if (medicalNo) medicalNo.checked = true;
            }
            toggleMedicalDetails();
            updateEndDatePreview();
        }
        formModal.classList.remove('hidden');
    };

    const closeAllModals = () => {
        formModal.classList.add('hidden');
        detailsModal.classList.add('hidden');
    };

    // --- EVENT LISTENERS ---
    addClientBtn.addEventListener('click', () => openFormModal());
    clientForm.addEventListener('submit', handleFormSubmit);
    searchBar.addEventListener('input', renderClients);

    // ✅ NEW: Medical condition event listeners
    const medicalYes = document.getElementById('medical-yes');
    const medicalNo = document.getElementById('medical-no');
    if (medicalYes) medicalYes.addEventListener('change', toggleMedicalDetails);
    if (medicalNo) medicalNo.addEventListener('change', toggleMedicalDetails);

    // Use event delegation for dynamic buttons
    clientListContainer.addEventListener('click', (e) => {
        const clientItem = e.target.closest('.client-item');
        if (!clientItem) return;
        const clientId = clientItem.dataset.id;
        const client = clients.find(c => c._id === clientId);
        if (e.target.closest('.delete-btn')) {
            handleDelete(clientId);
        } else if (e.target.closest('.edit-btn')) {
            if (client) {
                openFormModal(client);
            }
        } else if (e.target.closest('.whatsapp-btn')) {
            if (client) {
                openWhatsApp(client.contact, client.name, client.membership.endDate);
            }
        } else {
            openDetailsModal(clientId);
        }
    });

    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', closeAllModals));
    formModal.addEventListener('click', (e) => e.target === formModal && closeAllModals());
    detailsModal.addEventListener('click', (e) => e.target === detailsModal && closeAllModals());
    feeDateInput.addEventListener('change', updateEndDatePreview);
    monthsInput.addEventListener('change', updateEndDatePreview);

    // --- INITIALIZATION ---
    fetchClients();
});

// Enhanced window.confirm with better styling
window.confirm = (message) => {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal-backdrop';
        modal.innerHTML = `
            <div class="confirm-modal-content">
                <p>${message}</p>
                <div class="confirm-actions">
                    <button class="confirm-btn-no">Cancel</button>
                    <button class="confirm-btn-yes">Delete</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Focus on the cancel button by default for safety
        setTimeout(() => {
            modal.querySelector('.confirm-btn-no').focus();
        }, 100);

        const handleResponse = (result) => {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 200);
            resolve(result);
        };

        modal.querySelector('.confirm-btn-yes').addEventListener('click', () => handleResponse(true));
        modal.querySelector('.confirm-btn-no').addEventListener('click', () => handleResponse(false));

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleResponse(false);
            }
        });

        // Close on Escape key
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleKeydown);
                handleResponse(false);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    });
};


// Enhanced toggleMedicalDetails with color changes
const toggleMedicalDetails = () => {
    const medicalYes = document.getElementById('medical-yes');
    const medicalNo = document.getElementById('medical-no');
    const medicalDetailsRow = document.getElementById('medical-details-row');
    const medicalDetailsTextarea = document.getElementById('medical-details');

    // Get the labels
    const noLabel = medicalNo ? medicalNo.closest('.radio-label') : null;
    const yesLabel = medicalYes ? medicalYes.closest('.radio-label') : null;

    // Remove previous selection classes
    if (noLabel) noLabel.classList.remove('selected-no', 'selected-yes');
    if (yesLabel) yesLabel.classList.remove('selected-no', 'selected-yes');

    if (medicalYes && medicalYes.checked) {
        // "Yes" is selected
        if (medicalDetailsRow) medicalDetailsRow.style.display = 'block';
        if (medicalDetailsTextarea) medicalDetailsTextarea.required = true;
        if (yesLabel) yesLabel.classList.add('selected-yes');
    } else {
        // "No" is selected
        if (medicalDetailsRow) medicalDetailsRow.style.display = 'none';
        if (medicalDetailsTextarea) {
            medicalDetailsTextarea.required = false;
            medicalDetailsTextarea.value = '';
        }
        if (noLabel) noLabel.classList.add('selected-no');
    }
};

