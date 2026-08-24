"""Router sub-package — re-exports every router module for clean imports in main.py."""
from . import auth, upload, datasets, training, unsupervised, chat_export  # noqa: F401
