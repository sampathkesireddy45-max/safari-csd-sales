from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from ..utils.database import Base
import datetime

class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventory.id"), nullable=False)
    quantity_change = Column(Integer, nullable=False)  # positive for addition, negative for reduction
    transaction_type = Column(String, nullable=False)  # e.g., 'stock_received', 'sale', 'damage', 'adjustment'
    reference_id = Column(Integer, nullable=True)  # ID of the related record (sale_id, damage_report_id, etc.)
    reference_type = Column(String, nullable=True)   # e.g., 'sale', 'damage_report', 'adjustment'
    performed_by = Column(Integer, ForeignKey("employees.id"), nullable=False)  # employee who performed the transaction
    performed_at = Column(DateTime, default=datetime.datetime.utcnow)
    notes = Column(String, nullable=True)

    # Relationships
    inventory = relationship("Inventory")
    employee = relationship("Employee")
