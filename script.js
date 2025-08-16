class MTGDeckSubmitter {
    constructor() {
        this.apiUrl = 'https://api.github.com';
        this.repoOwner = 'Tleety'; // Repository owner
        this.repoName = 'mtg-deck-lists'; // Repository name
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Form submission
        document.getElementById('decklist-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmission();
        });

        // Token help toggle
        document.getElementById('token-help-link').addEventListener('click', (e) => {
            e.preventDefault();
            const helpPanel = document.getElementById('token-help');
            const isVisible = helpPanel.style.display !== 'none';
            helpPanel.style.display = isVisible ? 'none' : 'block';
        });

        // Real-time validation
        document.getElementById('decklist').addEventListener('input', (e) => {
            this.validateDecklist(e.target.value);
        });
    }

    async handleFormSubmission() {
        try {
            // Clear previous messages
            this.clearMessages();
            
            // Get form data
            const formData = this.getFormData();
            
            // Validate inputs
            if (!this.validateInputs(formData)) {
                return;
            }

            // Show loading state
            this.setLoadingState(true);

            // Parse and validate decklist
            const parsedDeck = this.parseDeck(formData.decklist);
            if (!parsedDeck) {
                this.showMessage('error', 'Invalid decklist format. Please check your input.');
                return;
            }

            // Format the deck file content
            const deckContent = this.formatDeckFile(parsedDeck, formData);

            // Generate filename
            const filename = this.generateFilename(formData.deckName, formData.format);

            // Submit to GitHub
            await this.submitToGitHub(formData.githubToken, filename, deckContent, formData);

            // Success!
            this.showMessage('success', 
                `🎉 Deck submitted successfully! ` +
                `<a href="https://github.com/${this.repoOwner}/${this.repoName}/blob/main/decks/${formData.format}/${filename}" target="_blank">View your deck</a>`
            );

            // Reset form
            this.resetForm();

        } catch (error) {
            console.error('Submission error:', error);
            this.showMessage('error', `Failed to submit deck: ${error.message}`);
        } finally {
            this.setLoadingState(false);
        }
    }

    getFormData() {
        return {
            githubToken: document.getElementById('github-token').value.trim(),
            deckName: document.getElementById('deck-name').value.trim(),
            format: document.getElementById('format').value,
            notes: document.getElementById('notes').value.trim(),
            decklist: document.getElementById('decklist').value.trim()
        };
    }

    validateInputs(formData) {
        const errors = [];

        if (!formData.githubToken) {
            errors.push('GitHub Personal Access Token is required');
        } else if (!formData.githubToken.startsWith('ghp_') && !formData.githubToken.startsWith('github_pat_')) {
            errors.push('Invalid GitHub token format');
        }

        if (!formData.deckName) {
            errors.push('Deck name is required');
        }

        if (!formData.format) {
            errors.push('Format selection is required');
        }

        if (!formData.decklist) {
            errors.push('Decklist is required');
        }

        if (errors.length > 0) {
            this.showMessage('error', errors.join('<br>'));
            return false;
        }

        return true;
    }

    parseDeck(decklistText) {
        try {
            const lines = decklistText.split('\n').map(line => line.trim()).filter(line => line);
            const deck = {
                mainboard: [],
                sideboard: []
            };

            let currentSection = 'mainboard';
            let totalCards = 0;

            for (const line of lines) {
                // Check for sideboard marker
                if (line.toLowerCase().includes('sideboard') && line.includes(':')) {
                    currentSection = 'sideboard';
                    continue;
                }

                // Skip empty lines and comments
                if (!line || line.startsWith('//') || line.startsWith('#')) {
                    continue;
                }

                // Parse card line (format: "4 Lightning Bolt" or "4x Lightning Bolt")
                const cardMatch = line.match(/^(\d+)x?\s+(.+)$/);
                if (cardMatch) {
                    const quantity = parseInt(cardMatch[1]);
                    const cardName = cardMatch[2].trim();
                    
                    if (quantity > 0 && cardName) {
                        deck[currentSection].push({
                            quantity: quantity,
                            name: cardName
                        });
                        totalCards += quantity;
                    }
                }
            }

            // Validate deck has cards
            if (deck.mainboard.length === 0) {
                return null;
            }

            deck.totalCards = totalCards;
            return deck;

        } catch (error) {
            console.error('Deck parsing error:', error);
            return null;
        }
    }

    validateDecklist(decklistText) {
        if (!decklistText.trim()) return;

        const parsed = this.parseDeck(decklistText);
        const messageContainer = document.getElementById('decklist').parentNode;
        
        // Remove previous validation message
        const existingMessage = messageContainer.querySelector('.validation-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        if (parsed) {
            const message = document.createElement('small');
            message.className = 'validation-message';
            message.style.color = '#27ae60';
            message.textContent = `✓ Valid format - ${parsed.mainboard.length} mainboard cards, ${parsed.sideboard.length} sideboard cards`;
            messageContainer.appendChild(message);
        } else {
            const message = document.createElement('small');
            message.className = 'validation-message';
            message.style.color = '#e74c3c';
            message.textContent = '⚠ Invalid format - please check your decklist';
            messageContainer.appendChild(message);
        }
    }

    formatDeckFile(parsedDeck, formData) {
        const date = new Date().toISOString().split('T')[0];
        let content = '';

        // Header with metadata
        content += `# ${formData.deckName}\n`;
        content += `Format: ${formData.format}\n`;
        content += `Date: ${date}\n`;
        if (formData.notes) {
            content += `Notes: ${formData.notes}\n`;
        }
        content += `\n`;

        // Mainboard
        content += `## Mainboard (${parsedDeck.mainboard.reduce((sum, card) => sum + card.quantity, 0)} cards)\n\n`;
        for (const card of parsedDeck.mainboard) {
            content += `${card.quantity} ${card.name}\n`;
        }

        // Sideboard (if exists)
        if (parsedDeck.sideboard.length > 0) {
            content += `\n## Sideboard (${parsedDeck.sideboard.reduce((sum, card) => sum + card.quantity, 0)} cards)\n\n`;
            for (const card of parsedDeck.sideboard) {
                content += `${card.quantity} ${card.name}\n`;
            }
        }

        return content;
    }

    generateFilename(deckName, format) {
        const date = new Date().toISOString().split('T')[0];
        const sanitizedName = deckName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
        
        return `${sanitizedName}-${date}.txt`;
    }

    async submitToGitHub(token, filename, content, formData) {
        const path = `decks/${formData.format}/${filename}`;
        
        try {
            // Check if file already exists
            let sha = null;
            try {
                const existingFile = await this.makeGitHubRequest(
                    token,
                    `GET`,
                    `/repos/${this.repoOwner}/${this.repoName}/contents/${path}`
                );
                sha = existingFile.sha;
                this.showMessage('warning', 'File already exists. It will be updated.');
            } catch (error) {
                // File doesn't exist, which is fine for creation
                if (error.status !== 404) {
                    throw error;
                }
            }

            // Create or update the file
            const requestBody = {
                message: `Add ${formData.format} deck: ${formData.deckName}`,
                content: btoa(unescape(encodeURIComponent(content))), // Base64 encode with UTF-8 support
                ...(sha && { sha }) // Include sha if updating existing file
            };

            await this.makeGitHubRequest(
                token,
                'PUT',
                `/repos/${this.repoOwner}/${this.repoName}/contents/${path}`,
                requestBody
            );

        } catch (error) {
            if (error.status === 401) {
                throw new Error('Invalid GitHub token. Please check your token and permissions.');
            } else if (error.status === 403) {
                throw new Error('Insufficient permissions. Make sure your token has "repo" scope.');
            } else if (error.status === 404) {
                throw new Error('Repository not found. Please check the repository name.');
            } else {
                throw new Error(`GitHub API error: ${error.message || 'Unknown error'}`);
            }
        }
    }

    async makeGitHubRequest(token, method, endpoint, body = null) {
        const url = `${this.apiUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            
            try {
                const errorData = await response.json();
                error.message = errorData.message || error.message;
            } catch (e) {
                // If we can't parse error JSON, use the status text
            }
            
            throw error;
        }

        return response.json();
    }

    showMessage(type, message) {
        const container = document.getElementById('status-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = message;
        container.appendChild(messageDiv);

        // Auto-remove success messages after 10 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 10000);
        }

        // Scroll to message
        messageDiv.scrollIntoView({ behavior: 'smooth' });
    }

    clearMessages() {
        const container = document.getElementById('status-messages');
        container.innerHTML = '';
    }

    setLoadingState(loading) {
        const submitBtn = document.getElementById('submit-btn');
        const originalText = '🚀 Submit Decklist';
        
        if (loading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loading-spinner"></span>Submitting...';
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    resetForm() {
        document.getElementById('decklist-form').reset();
        document.getElementById('github-token').value = '';
        
        // Remove validation messages
        const validationMessages = document.querySelectorAll('.validation-message');
        validationMessages.forEach(msg => msg.remove());
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MTGDeckSubmitter();
});