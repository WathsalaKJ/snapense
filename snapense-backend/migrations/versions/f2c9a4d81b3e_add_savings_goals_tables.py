"""add savings goals tables

Revision ID: f2c9a4d81b3e
Revises: d4f7a1c9e5b2
Create Date: 2026-09-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2c9a4d81b3e'
down_revision = 'd4f7a1c9e5b2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('savings_goals',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('target_amount', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('target_date', sa.Date(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('target_amount > 0', name='ck_savings_goals_target_amount_positive'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('savings_goals', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_savings_goals_user_id'), ['user_id'], unique=False)

    op.create_table('goal_contributions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('goal_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('contributed_at', sa.Date(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint('amount > 0', name='ck_goal_contributions_amount_positive'),
    sa.ForeignKeyConstraint(['goal_id'], ['savings_goals.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('goal_contributions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_goal_contributions_goal_id'), ['goal_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_goal_contributions_user_id'), ['user_id'], unique=False)


def downgrade():
    with op.batch_alter_table('goal_contributions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_goal_contributions_user_id'))
        batch_op.drop_index(batch_op.f('ix_goal_contributions_goal_id'))

    op.drop_table('goal_contributions')

    with op.batch_alter_table('savings_goals', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_savings_goals_user_id'))

    op.drop_table('savings_goals')
